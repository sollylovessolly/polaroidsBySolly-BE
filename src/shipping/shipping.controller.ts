import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
  rates(@Body() dto: ShippingRateDto) {
    return this.shipping.rates(dto);
  }
}
