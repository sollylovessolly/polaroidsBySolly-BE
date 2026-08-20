import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { DeliveryRatesService } from './delivery-rates.service';
import { CreateDeliveryRateDto } from './dto/create-delivery-rate.dto';
import { UpdateDeliveryRateDto } from './dto/update-delivery-rate.dto';
import { Public } from '../auth/public.decorator';

@ApiTags('Delivery Rates')
@Controller('delivery-rates')
export class DeliveryRatesController {
  constructor(private readonly deliveryRates: DeliveryRatesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List available delivery rates' })
  @ApiOkResponse({
    schema: { example: [{ state: 'Lagos', fee: '3800', isActive: true }] },
  })
  findAll() {
    return this.deliveryRates.findAll();
  }

  @Get(':state')
  @Public()
  @ApiOperation({ summary: 'Check delivery availability and rate by state' })
  @ApiOkResponse({
    schema: { example: { state: 'Lagos', fee: '3800', available: true } },
  })
  findByState(@Param('state') state: string) {
    return this.deliveryRates.findByState(state);
  }

  // TODO(Number 18): protect delivery-rate write endpoints with admin auth.
  @Post()
  @ApiOperation({ summary: 'Create a delivery rate (admin; auth pending)' })
  @ApiCreatedResponse({ description: 'Delivery rate created' })
  create(@Body() dto: CreateDeliveryRateDto) {
    return this.deliveryRates.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a delivery rate (admin; auth pending)' })
  update(@Param('id') id: string, @Body() dto: UpdateDeliveryRateDto) {
    return this.deliveryRates.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Disable a delivery rate (admin; auth pending)' })
  remove(@Param('id') id: string) {
    return this.deliveryRates.remove(id);
  }
}
