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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';
import { Public } from '../auth/public.decorator';

const productExample = {
  id: 'cmrwr5biv0000j53a8y0khjno',
  name: 'Polaroids',
  slug: 'polaroids',
  description: 'Custom Polaroid prints created from customer photos.',
  category: 'POLAROID',
  isActive: true,
  createdAt: '2026-07-23T00:07:51.070Z',
  updatedAt: '2026-07-23T00:07:51.070Z',
  variants: [
    {
      id: 'cmrwr5sta0001j53azu4d49hp',
      name: 'Standard Border',
      sku: 'POLAROID-STANDARD',
      sellingPrice: '3500',
      tracksStock: false,
      isActive: true,
      // Live inventory availability, computed from resource rules.
      // inStock:             can at least one unit be fulfilled right now
      // availableQuantity:   max sellable quantity, or null when the
      //                      variant is not limited by tracked stock
      // reasonIfUnavailable: name of the limiting resource when out of stock
      inStock: true,
      availableQuantity: 12,
      reasonIfUnavailable: null,
    },
  ],
};

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiCreatedResponse({
    description: 'The product was created successfully',
    schema: { example: productExample },
  })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all active products' })
  @ApiOkResponse({
    description: 'A list of products',
    schema: { example: [productExample] },
  })
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a single product by ID' })
  @ApiParam({ name: 'id', description: 'The product ID' })
  @ApiOkResponse({
    description: 'The requested product',
    schema: { example: productExample },
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOnePublic(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'The product ID' })
  @ApiOkResponse({
    description: 'The updated product',
    schema: { example: productExample },
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (deactivate) a product' })
  @ApiParam({ name: 'id', description: 'The product ID' })
  @ApiOkResponse({
    description: 'The deactivated product',
    schema: { example: { ...productExample, isActive: false } },
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
