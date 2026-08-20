import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';

@ApiTags('Discounts')
@Controller('discounts')
export class DiscountsController {
  constructor(private readonly discounts: DiscountsService) {}
  @Post() create(@Body() dto: CreateDiscountDto) {
    return this.discounts.create(dto);
  }
  @Get() findAll() {
    return this.discounts.findAll();
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.discounts.findOne(id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.discounts.update(id, dto);
  }
  @Delete(':id') remove(@Param('id') id: string) {
    return this.discounts.remove(id);
  }
}
