import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { RateLimit } from '../security/rate-limit.decorator';
import { ShippingRateDto } from './dto/shipping-rate.dto';
import { ShippingService } from './shipping.service';

@ApiTags('Shipping')
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}
  @Post('rates')
  @Public()
  @RateLimit('SHIPPING_RATE_LIMIT_PER_MINUTE', 20)
  @ApiOperation({
    summary: 'Validate an address and fetch customer-safe Shipbubble rates',
  })
  @ApiOkResponse({
    schema: {
      example: {
        requestToken: 'opaque-rate-token',
        couriers: [
          {
            courierId: 'courier-id',
            courierName: 'Courier',
            serviceCode: 'service-code',
            serviceType: 'Express',
            deliveryEta: '1-2 days',
            currency: 'NGN',
            total: 3500,
          },
        ],
      },
    },
  })
  rates(@Body() dto: ShippingRateDto) {
    return this.shipping.rates(dto);
  }
}
