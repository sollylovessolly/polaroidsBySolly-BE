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

const productExample = {
  id: 'cmrwr5biv0000j53a8y0khjno',
  name: 'Polaroids',
  slug: 'polaroids',
  description: 'Custom Polaroid prints created from customer photos.',
  category: 'POLAROID',
  isActive: true,
  createdAt: '2026-07-23T00:07:51.070Z',
  updatedAt: '2026-07-23T00:07:51.070Z',
  variants: [],
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
  @ApiOperation({ summary: 'List all active products' })
  @ApiOkResponse({
    description: 'A list of products',
    schema: { example: [productExample] },
  })
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID' })
  @ApiParam({ name: 'id', description: 'The product ID' })
  @ApiOkResponse({
    description: 'The requested product',
    schema: { example: productExample },
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'The product ID' })
  @ApiOkResponse({
    description: 'The updated product',
    schema: { example: productExample },
  })
  @ApiNotFoundResponse({ description: 'Product not found' })
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
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
