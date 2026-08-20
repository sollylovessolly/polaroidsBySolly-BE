import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { CustomerFiltersDto } from './dto/customer-filters.dto';
import { CustomersService } from './customers.service';
class ArchiveCustomerDto {
  @IsBoolean() archived!: boolean;
}
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}
  @Get() findAll(@Query() filters: CustomerFiltersDto) {
    return this.customers.findAll(filters);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }
  @Patch(':id/archive') archive(
    @Param('id') id: string,
    @Body() dto: ArchiveCustomerDto,
  ) {
    return this.customers.archive(id, dto.archived);
  }
}
