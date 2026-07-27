import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

const orderExample = {
  id: 'cmrworder0001',
  orderNumber: 'PBS-1753478871070',
  customerId: 'cmrwcustomer0001',
  source: 'WEBSITE',
  status: 'PENDING',
  paymentStatus: 'UNPAID',
  subtotal: '11000',
  deliveryFee: '0',
  discount: '0',
  totalAmount: '11000',
  deliveryState: 'Lagos',
  deliveryAddress: '12 Marina Road, Victoria Island',
  customerNote: 'Please deliver before 5pm',
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
      variantId: 'cmrwr5sta0001j53azu4d49hp',
      quantity: 2,
      unitPriceSnapshot: '5500',
      totalPriceSnapshot: '11000',
    },
  ],
};

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiCreatedResponse({
    description: 'The order was created successfully',
    schema: { example: orderExample },
  })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all orders' })
  @ApiOkResponse({
    description: 'A list of orders',
    schema: { example: [orderExample] },
  })
  findAll() {
    return this.ordersService.findAll();
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
