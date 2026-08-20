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

import { CreateResourceRuleDto } from './dto/create-resource-rule.dto';
import { UpdateResourceRuleDto } from './dto/update-resource-rule.dto';
import { ResourceRulesService } from './resource-rules.service';

@ApiTags('Resource Rules')
@Controller('resource-rules')
export class ResourceRulesController {
  constructor(private readonly resourceRulesService: ResourceRulesService) {}

  @Post()
  @ApiOperation({
    summary: 'Connect a product variant to a resource',
  })
  @ApiCreatedResponse({
    description: 'Resource rule created successfully',
  })
  @ApiNotFoundResponse({
    description: 'Variant or resource was not found',
  })
  create(@Body() dto: CreateResourceRuleDto) {
    return this.resourceRulesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all resource rules',
  })
  @ApiQuery({
    name: 'variantId',
    required: false,
    description: 'Filter rules by product variant ID',
    example: 'VARIANT_ID_HERE',
  })
  @ApiOkResponse({
    description: 'Resource rules returned successfully',
  })
  findAll(@Query('variantId') variantId?: string) {
    return this.resourceRulesService.findAll(variantId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one resource rule',
  })
  @ApiParam({
    name: 'id',
    example: 'RESOURCE_RULE_ID_HERE',
  })
  findOne(@Param('id') id: string) {
    return this.resourceRulesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a resource rule',
  })
  @ApiParam({
    name: 'id',
    example: 'RESOURCE_RULE_ID_HERE',
  })
  update(@Param('id') id: string, @Body() dto: UpdateResourceRuleDto) {
    return this.resourceRulesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a resource rule',
  })
  @ApiParam({
    name: 'id',
    example: 'RESOURCE_RULE_ID_HERE',
  })
  remove(@Param('id') id: string) {
    return this.resourceRulesService.remove(id);
  }
}
