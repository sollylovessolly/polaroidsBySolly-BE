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
  ApiTags,
} from '@nestjs/swagger';

import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SuppliersService } from './suppliers.service';
import { SupplierFiltersDto } from './dto/supplier-filters.dto';

const supplierExample = {
  id: 'cmrwsupplier0001',
  name: 'Film Supplier Lagos',
  phone: '08012345678',
  email: 'supplier@example.com',
  note: 'Main film supplier for Instax mini sheets',
  isActive: true,
  createdAt: '2026-07-23T00:07:51.070Z',
  updatedAt: '2026-07-23T00:07:51.070Z',
};

@ApiTags('suppliers')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiCreatedResponse({
    description: 'The supplier was created successfully',
    schema: { example: supplierExample },
  })
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all active suppliers' })
  @ApiOkResponse({
    description: 'A list of suppliers',
    schema: { example: [supplierExample] },
  })
  findAll(@Query() filters: SupplierFiltersDto) {
    return this.suppliersService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single supplier by ID (includes recent purchases)',
  })
  @ApiParam({ name: 'id', description: 'The supplier ID' })
  @ApiOkResponse({
    description: 'The requested supplier',
    schema: { example: { ...supplierExample, purchases: [] } },
  })
  @ApiNotFoundResponse({ description: 'Supplier not found' })
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a supplier' })
  @ApiParam({ name: 'id', description: 'The supplier ID' })
  @ApiOkResponse({
    description: 'The updated supplier',
    schema: { example: supplierExample },
  })
  @ApiNotFoundResponse({ description: 'Supplier not found' })
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete (deactivate) a supplier',
  })
  @ApiParam({ name: 'id', description: 'The supplier ID' })
  @ApiOkResponse({
    description: 'The deactivated supplier',
    schema: { example: { ...supplierExample, isActive: false } },
  })
  @ApiNotFoundResponse({ description: 'Supplier not found' })
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }
}
