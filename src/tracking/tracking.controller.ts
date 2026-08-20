import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { TrackOrdersDto } from './dto/track-orders.dto';
import { TrackingService } from './tracking.service';
import { Public } from '../auth/public.decorator';
import { RateLimit } from '../security/rate-limit.decorator';

@Public()
@ApiTags('Tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post('orders')
  @RateLimit('TRACKING_RATE_LIMIT_PER_MINUTE', 30)
  @ApiOperation({ summary: 'Find paid customer orders by phone number' })
  @ApiOkResponse({ description: 'Customer-safe order cards or an empty list' })
  findByPhone(@Body() dto: TrackOrdersDto) {
    return this.tracking.findByPhone(dto.phone);
  }

  @Get(':token')
  @ApiOperation({ summary: 'Open customer-safe tracking detail' })
  @ApiNotFoundResponse({ description: 'Tracked order was not found' })
  findOne(@Param('token') token: string) {
    return this.tracking.findOne(token);
  }
}
