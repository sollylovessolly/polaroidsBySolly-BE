import {
  Body,
  Controller,
  Delete,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import { VariantsService } from './variants.service';

const variantExample = {
  id: 'cmrwr5sta0001j53azu4d49hp',
  name: 'iPhone 15 Pro',
  sku: 'PHONECASE-IP15-PRO',
  productId: 'cmrwr5biv0000j53a8y0khjno',
  sellingPrice: '5500',
  tracksStock: true,
  isActive: true,
  outsourcedUnitCost: '0',
  supplierId: null,
  createdAt: '2026-07-23T00:07:51.070Z',
  updatedAt: '2026-07-23T00:07:51.070Z',
  product: {
    id: 'cmrwr5biv0000j53a8y0khjno',
    name: 'Phone Cases',
    slug: 'phone-cases',
    description: 'Custom phone cases',
    category: 'PHONE_CASE',
    isActive: true,
    createdAt: '2026-07-23T00:07:51.070Z',
    updatedAt: '2026-07-23T00:07:51.070Z',
  },
};

@ApiTags('variants')
@Controller('variants')
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product variant' })
  @ApiCreatedResponse({
    description: 'The variant was created successfully',
    schema: { example: variantExample },
  })
  create(@Body() dto: CreateVariantDto) {
    return this.variantsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all variants (optionally filtered by product)',
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    description:
      'Optional product ID to filter variants. Omit to return all variants.',
  })
  @ApiOkResponse({
    description: 'A list of variants',
    schema: { example: [variantExample] },
  })
  findAll(@Query('productId') productId?: string) {
    return this.variantsService.findAll(productId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single variant by ID' })
  @ApiParam({ name: 'id', description: 'The variant ID' })
  @ApiOkResponse({
    description: 'The requested variant',
    schema: { example: variantExample },
  })
  @ApiNotFoundResponse({ description: 'Variant not found' })
  findOne(@Param('id') id: string) {
    return this.variantsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a variant' })
  @ApiParam({ name: 'id', description: 'The variant ID' })
  @ApiOkResponse({
    description: 'The updated variant',
    schema: { example: variantExample },
  })
  @ApiNotFoundResponse({ description: 'Variant not found' })
  update(@Param('id') id: string, @Body() dto: UpdateVariantDto) {
    return this.variantsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (deactivate) a variant' })
  @ApiParam({ name: 'id', description: 'The variant ID' })
  @ApiOkResponse({
    description: 'The deactivated variant',
    schema: { example: { ...variantExample, isActive: false } },
  })
  @ApiNotFoundResponse({ description: 'Variant not found' })
  remove(@Param('id') id: string) {
    return this.variantsService.remove(id);
  }
}
