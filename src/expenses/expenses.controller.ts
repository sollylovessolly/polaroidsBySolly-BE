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
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseFiltersDto } from './dto/expense-filters.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('Expenses — Admin')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  // TODO(Number 18): protect all expense endpoints with admin auth.
  @Post()
  @ApiOperation({ summary: 'Create an operating expense (admin)' })
  create(@Body() dto: CreateExpenseDto) {
    return this.expenses.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List and filter operating expenses (admin)' })
  findAll(@Query() filters: ExpenseFiltersDto) {
    return this.expenses.findAll(filters);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Summarize expenses by category (admin)' })
  summary(@Query() filters: ExpenseFiltersDto) {
    return this.expenses.summary(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.expenses.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.expenses.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expenses.remove(id);
  }
}
