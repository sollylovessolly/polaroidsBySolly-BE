import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ShipbubbleLabel = {
  orderId: string;
  status: string;
  trackingUrl: string | null;
  shippingFee: number;
};

export type ShippingRates = {
  requestToken: string;
  couriers: Array<{
    courierId: string;
    courierName: string;
    serviceCode: string;
    serviceType: string;
    deliveryEta: string | null;
    currency: string;
    total: number;
  }>;
};

@Injectable()
export class ShipbubbleService {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    const key = this.config.get<string>('SHIPBUBBLE_API_KEY');
    return Boolean(key && key !== 'replace_me');
  }

  async createShipment(input: {
    requestToken: string;
    serviceCode: string;
    courierId: string;
  }): Promise<ShipbubbleLabel> {
    const response = await this.request('/shipping/labels', {
      method: 'POST',
      body: JSON.stringify({
        request_token: input.requestToken,
        service_code: input.serviceCode,
        courier_id: input.courierId,
        is_cod_label: false,
      }),
    });
    const body = response as {
      data?: {
        order_id?: string;
        status?: string;
        tracking_url?: string;
        payment?: { shipping_fee?: number };
      };
    };
    if (
      !body.data?.order_id ||
      !Number.isFinite(Number(body.data.payment?.shipping_fee))
    )
      throw new Error('Shipbubble returned an incomplete shipment response');
    return {
      orderId: body.data.order_id,
      status: body.data.status ?? 'pending',
      trackingUrl: body.data.tracking_url ?? null,
      shippingFee: Number(body.data.payment?.shipping_fee),
    };
  }

  async validateAddress(input: {
    name: string;
    email: string;
    phone: string;
    address: string;
  }) {
    const response = (await this.request('/shipping/address/validate', {
      method: 'POST',
      body: JSON.stringify(input),
    })) as { data?: { address_code?: number } };
    if (!response.data?.address_code)
      throw new Error('Shipbubble could not validate the delivery address');
    return response.data.address_code;
  }

  async fetchRates(input: {
    receiverAddressCode: number;
    pickupDate: string;
    packageItems: Array<{
      name: string;
      description: string;
      unit_weight: string;
      unit_amount: string;
      quantity: string;
    }>;
  }): Promise<ShippingRates> {
    const senderAddressCode = Number(
      this.config.get('SHIPBUBBLE_SENDER_ADDRESS_CODE'),
    );
    const categoryId = Number(this.config.get('SHIPBUBBLE_CATEGORY_ID'));
    if (!Number.isInteger(senderAddressCode) || !Number.isInteger(categoryId))
      throw new Error('Shipbubble sender address/category is not configured');
    const response = (await this.request('/shipping/fetch_rates', {
      method: 'POST',
      body: JSON.stringify({
        sender_address_code: senderAddressCode,
        reciever_address_code: input.receiverAddressCode,
        pickup_date: input.pickupDate,
        category_id: categoryId,
        package_items: input.packageItems,
        package_dimension: {
          length: Number(this.config.get('SHIPBUBBLE_PACKAGE_LENGTH_CM', 25)),
          width: Number(this.config.get('SHIPBUBBLE_PACKAGE_WIDTH_CM', 20)),
          height: Number(this.config.get('SHIPBUBBLE_PACKAGE_HEIGHT_CM', 8)),
        },
      }),
    })) as {
      data?: {
        request_token?: string;
        couriers?: Array<Record<string, unknown>>;
      };
    };
    if (!response.data?.request_token || !Array.isArray(response.data.couriers))
      throw new Error('Shipbubble returned an incomplete rates response');
    return {
      requestToken: response.data.request_token,
      couriers: response.data.couriers.map((rate) => ({
        courierId: String(rate.courier_id),
        courierName: String(rate.courier_name),
        serviceCode: String(rate.service_code),
        serviceType: String(rate.service_type),
        deliveryEta:
          typeof rate.delivery_eta === 'string' ? rate.delivery_eta : null,
        currency: typeof rate.currency === 'string' ? rate.currency : 'NGN',
        total: Number(rate.total),
      })),
    };
  }

  private async request(path: string, init: RequestInit) {
    const key = this.config.get<string>('SHIPBUBBLE_API_KEY');
    if (!key || key === 'replace_me')
      throw new Error('Shipbubble is not configured');
    const base = this.config
      .get<string>('SHIPBUBBLE_BASE_URL', 'https://api.shipbubble.com/v1')
      .replace(/\/$/, '');
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok)
      throw new Error(
        `Shipbubble request failed with status ${response.status}`,
      );
    return response.json() as Promise<unknown>;
  }
}
