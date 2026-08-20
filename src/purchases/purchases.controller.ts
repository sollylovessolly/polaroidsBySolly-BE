import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchasesService } from './purchases.service';
import { PurchaseFiltersDto } from './dto/purchase-filters.dto';

const purchaseExample = {
  id: 'cmrwpurchase0001',
  supplierId: 'cmrwsupplier0001',
  totalCost: '2700',
  note: 'Bought 3 packs of Instax film',
  purchasedAt: '2026-07-25T21:00:00.000Z',
  createdAt: '2026-07-25T21:00:00.000Z',
  items: [
    {
      id: 'cmrwpurchaseitem0001',
      purchaseId: 'cmrwpurchase0001',
      resourceId: 'cmrwr5resource0001',
      purchaseQuantity: '3',
      purchaseUnit: 'PACK',
      unitsPerPurchaseUnit: '20',
      totalBaseUnits: '60',
      totalCost: '2700',
      unitCost: '45',
    },
  ],
};

@ApiTags('purchases')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Record a purchase and restock its resources (weighted-average cost)',
  })
  @ApiCreatedResponse({
    description: 'The purchase was recorded and inventory was restocked',
    schema: { example: purchaseExample },
  })
  @ApiBadRequestResponse({
    description: 'Invalid purchase payload',
  })
  @ApiNotFoundResponse({
    description: 'Supplier or resource was not found',
  })
  create(@Body() dto: CreatePurchaseDto) {
    return this.purchasesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all purchases' })
  @ApiOkResponse({
    description: 'A list of purchases',
    schema: { example: [purchaseExample] },
  })
  findAll(@Query() filters: PurchaseFiltersDto) {
    return this.purchasesService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single purchase by ID' })
  @ApiParam({ name: 'id', description: 'The purchase ID' })
  @ApiOkResponse({
    description: 'The requested purchase',
    schema: { example: purchaseExample },
  })
  @ApiNotFoundResponse({ description: 'Purchase not found' })
  findOne(@Param('id') id: string) {
    return this.purchasesService.findOne(id);
  }
}
