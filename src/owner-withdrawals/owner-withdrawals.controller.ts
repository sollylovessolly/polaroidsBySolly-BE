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
import { ApiTags } from '@nestjs/swagger';
import { CreateOwnerWithdrawalDto } from './dto/create-owner-withdrawal.dto';
import { UpdateOwnerWithdrawalDto } from './dto/update-owner-withdrawal.dto';
import { WithdrawalFiltersDto } from './dto/withdrawal-filters.dto';
import { OwnerWithdrawalsService } from './owner-withdrawals.service';

@ApiTags('Owner Withdrawals — Admin')
@Controller('owner-withdrawals')
export class OwnerWithdrawalsController {
  constructor(private readonly withdrawals: OwnerWithdrawalsService) {}
  @Post() create(@Body() dto: CreateOwnerWithdrawalDto) {
    return this.withdrawals.create(dto);
  }
  @Get() findAll(@Query() filters: WithdrawalFiltersDto) {
    return this.withdrawals.findAll(filters);
  }
  @Get('summary') summary(@Query() filters: WithdrawalFiltersDto) {
    return this.withdrawals.summary(filters);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.withdrawals.findOne(id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @Body() dto: UpdateOwnerWithdrawalDto,
  ) {
    return this.withdrawals.update(id, dto);
  }
  @Delete(':id') remove(@Param('id') id: string) {
    return this.withdrawals.remove(id);
  }
}
