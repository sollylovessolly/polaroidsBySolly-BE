import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CreateOrderDto } from './dto/create-order.dto';
import { CreateManualOrderDto } from './dto/create-manual-order.dto';
import { ManualPaymentDto } from './dto/manual-payment.dto';
import { OrderFiltersDto } from './dto/order-filters.dto';
import { UpdateAdminNoteDto } from './dto/update-admin-note.dto';
import { UpdateDeliveryCostDto } from './dto/update-delivery-cost.dto';
import { UpdateFulfillmentDto } from './dto/update-fulfillment.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateTrackingDto } from './dto/update-tracking.dto';
import { OrdersService } from './orders.service';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { Public } from '../auth/public.decorator';
import { RateLimit } from '../security/rate-limit.decorator';

const orderExample = {
  id: 'cmrworder0001',
  orderNumber: 'PBS-1753478871070',
  customerId: 'cmrwcustomer0001',
  source: 'WEBSITE',
  status: 'PENDING',
  paymentStatus: 'UNPAID',
  subtotal: '20000',
  deliveryFee: '3800',
  discount: '0',
  totalAmount: '23800',
  deliveryState: 'Lagos',
  deliveryAddress: '12 Marina Road, Victoria Island',
  customerNote: 'Please package carefully',
  createdAt: '2026-07-25T21:00:00.000Z',
  updatedAt: '2026-07-25T21:00:00.000Z',
  customer: {
    id: 'cmrwcustomer0001',
    name: 'Jane Doe',
    phone: '08012345678',
    email: 'jane@example.com',
  },
  items: [
    {
      id: 'cmrworderitem0001',
      orderId: 'cmrworder0001',
      quantity: 2,
      unitPriceSnapshot: '3500',
      totalPriceSnapshot: '7000',
      customization: {
        finalPngUrl: 'https://storage.example/polaroids.png',
        previewUrl: 'https://storage.example/polaroids-preview.png',
      },
      variant: {
        name: 'Standard Polaroid',
        sku: 'POLAROID-STANDARD',
        product: { name: 'Polaroids', category: 'POLAROID' },
      },
    },
  ],
};

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Public()
  @RateLimit('ORDER_RATE_LIMIT_PER_MINUTE', 10)
  @ApiOperation({ summary: 'Create a new order' })
  @ApiCreatedResponse({
    description: 'The order was created successfully',
    schema: { example: orderExample },
  })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  // TODO(Number 18): protect all manual/admin mutation endpoints with auth.
  @Post('manual')
  @ApiOperation({
    summary: 'Create a WhatsApp, Instagram, or manual order (admin)',
  })
  createManual(@Body() dto: CreateManualOrderDto) {
    return this.ordersService.createManual(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all orders' })
  @ApiOkResponse({
    description: 'A list of orders',
    schema: { example: [orderExample] },
  })
  findAll(@Query() filters: OrderFiltersDto) {
    return this.ordersService.findAll(filters);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update fulfillment status and append history (admin)',
  })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }

  @Patch(':id/admin-note')
  @ApiOperation({ summary: 'Update the private admin note (admin)' })
  updateAdminNote(@Param('id') id: string, @Body() dto: UpdateAdminNoteDto) {
    return this.ordersService.updateAdminNote(id, dto);
  }

  @Patch(':id/tracking')
  @ApiOperation({ summary: 'Set the delivery tracking link (admin)' })
  updateTracking(@Param('id') id: string, @Body() dto: UpdateTrackingDto) {
    return this.ordersService.updateTracking(id, dto);
  }

  @Patch(':id/delivery-cost')
  @ApiOperation({
    summary: 'Set actual courier cost and refresh frozen profit (admin)',
  })
  updateDeliveryCost(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryCostDto,
  ) {
    return this.ordersService.updateDeliveryCost(id, dto);
  }

  @Patch(':orderId/items/:itemId/fulfillment')
  @ApiOperation({ summary: 'Attach validated fulfillment files (admin)' })
  updateFulfillment(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateFulfillmentDto,
  ) {
    return this.ordersService.updateFulfillment(orderId, itemId, dto);
  }

  @Post(':id/manual-payment')
  @ApiOperation({
    summary:
      'Record trusted TRANSFER/OPAY payment and finalize inventory (admin)',
  })
  recordManualPayment(@Param('id') id: string, @Body() dto: ManualPaymentDto) {
    return this.ordersService.recordManualPayment(id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary:
      'Cancel an order with optional explicit inventory restoration (admin)',
  })
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancel(id, dto);
  }

  @Post(':id/shipment/retry')
  @ApiOperation({
    summary: 'Retry failed Shipbubble shipment creation (admin)',
  })
  retryShipment(@Param('id') id: string) {
    return this.ordersService.retryShipment(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single order by ID' })
  @ApiParam({ name: 'id', description: 'The order ID' })
  @ApiOkResponse({
    description: 'The requested order',
    schema: { example: orderExample },
  })
  @ApiNotFoundResponse({ description: 'Order not found' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
