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

import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourcesService } from './resources.service';

const resourceExample = {
  id: 'cmrwr5resource0001',
  name: 'Polaroid Film',
  sku: 'FILM-POLAROID-STD',
  category: 'MATERIAL',
  unit: 'SHEET',
  currentStock: '100',
  averageUnitCost: '250',
  lowStockThreshold: '20',
  isActive: true,
  createdAt: '2026-07-23T00:07:51.070Z',
  updatedAt: '2026-07-23T00:07:51.070Z',
};

@ApiTags('resources')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new resource' })
  @ApiCreatedResponse({
    description: 'The resource was created successfully',
    schema: { example: resourceExample },
  })
  create(@Body() dto: CreateResourceDto) {
    return this.resourcesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all active resources (optionally only low-stock)',
  })
  @ApiQuery({
    name: 'lowStock',
    required: false,
    description:
      'Set to "true" to only return resources at or below their low-stock threshold. Omit to return all.',
  })
  @ApiOkResponse({
    description: 'A list of resources',
    schema: { example: [resourceExample] },
  })
  findAll(@Query('lowStock') lowStock?: string) {
    return this.resourcesService.findAll(lowStock === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single resource by ID' })
  @ApiParam({ name: 'id', description: 'The resource ID' })
  @ApiOkResponse({
    description: 'The requested resource (includes recent movements)',
    schema: { example: { ...resourceExample, movements: [] } },
  })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  findOne(@Param('id') id: string) {
    return this.resourcesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a resource' })
  @ApiParam({ name: 'id', description: 'The resource ID' })
  @ApiOkResponse({
    description: 'The updated resource',
    schema: { example: resourceExample },
  })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resourcesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete (deactivate) a resource' })
  @ApiParam({ name: 'id', description: 'The resource ID' })
  @ApiOkResponse({
    description: 'The deactivated resource',
    schema: { example: { ...resourceExample, isActive: false } },
  })
  @ApiNotFoundResponse({ description: 'Resource not found' })
  remove(@Param('id') id: string) {
    return this.resourcesService.remove(id);
  }
}
