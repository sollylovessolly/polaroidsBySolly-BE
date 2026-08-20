import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseFiltersDto } from './dto/expense-filters.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { paginated, pagination } from '../common/dto/pagination.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExpenseDto) {
    await this.validateRelatedOrder(dto.relatedOrderId);
    return this.prisma.expense.create({
      data: { ...dto, amount: new Prisma.Decimal(dto.amount.toString()) },
    });
  }

  async findAll(filters: ExpenseFiltersDto = {}) {
    this.validateRange(filters);
    const where = this.where(filters);
    const { page, limit, skip, take } = pagination(filters);
    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { expenseDate: 'desc' },
        skip,
        take,
      }),
      this.prisma.expense.count({ where }),
    ]);
    return paginated(data, total, page, limit);
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      throw new NotFoundException(`Expense with ID "${id}" was not found`);
    }
    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto) {
    await this.findOne(id);
    await this.validateRelatedOrder(dto.relatedOrderId);
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...dto,
        amount:
          dto.amount === undefined
            ? undefined
            : new Prisma.Decimal(dto.amount.toString()),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.expense.delete({ where: { id } });
  }

  async summary(filters: ExpenseFiltersDto = {}) {
    this.validateRange(filters);
    const groups = await this.prisma.expense.groupBy({
      by: ['category'],
      where: this.where(filters),
      _sum: { amount: true },
      orderBy: { category: 'asc' },
    });
    const byCategory = groups.map((group) => ({
      category: group.category,
      amount: group._sum.amount ?? 0,
    }));
    const total = byCategory.reduce(
      (sum, group) => sum.plus(group.amount),
      new Prisma.Decimal(0),
    );
    return { total, byCategory };
  }

  private where(filters: ExpenseFiltersDto) {
    return {
      category: filters.category,
      ...(filters.from || filters.to
        ? {
            expenseDate: {
              gte: filters.from,
              lte: filters.to,
            },
          }
        : {}),
    };
  }

  private validateRange(filters: ExpenseFiltersDto) {
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new BadRequestException('from must be before to');
    }
  }

  private async validateRelatedOrder(orderId?: string) {
    if (!orderId) return;
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) {
      throw new BadRequestException(
        `Related order with ID "${orderId}" was not found`,
      );
    }
  }
}
