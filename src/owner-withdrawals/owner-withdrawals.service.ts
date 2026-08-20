import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOwnerWithdrawalDto } from './dto/create-owner-withdrawal.dto';
import { UpdateOwnerWithdrawalDto } from './dto/update-owner-withdrawal.dto';
import { WithdrawalFiltersDto } from './dto/withdrawal-filters.dto';
import { paginated, pagination } from '../common/dto/pagination.dto';

@Injectable()
export class OwnerWithdrawalsService {
  constructor(private readonly prisma: PrismaService) {}
  create(dto: CreateOwnerWithdrawalDto) {
    return this.prisma.ownerWithdrawal.create({
      data: { ...dto, amount: new Prisma.Decimal(dto.amount.toString()) },
    });
  }
  async findAll(filters: WithdrawalFiltersDto = {}) {
    this.range(filters);
    const where = this.where(filters);
    const { page, limit, skip, take } = pagination(filters);
    const [data, total] = await Promise.all([
      this.prisma.ownerWithdrawal.findMany({
        where,
        orderBy: { withdrawnAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.ownerWithdrawal.count({ where }),
    ]);
    return paginated(data, total, page, limit);
  }
  async findOne(id: string) {
    const value = await this.prisma.ownerWithdrawal.findUnique({
      where: { id },
    });
    if (!value)
      throw new NotFoundException(
        `Owner withdrawal with ID "${id}" was not found`,
      );
    return value;
  }
  async update(id: string, dto: UpdateOwnerWithdrawalDto) {
    await this.findOne(id);
    return this.prisma.ownerWithdrawal.update({
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
    return this.prisma.ownerWithdrawal.delete({ where: { id } });
  }
  async summary(filters: WithdrawalFiltersDto = {}) {
    this.range(filters);
    const result = await this.prisma.ownerWithdrawal.aggregate({
      where: this.where(filters),
      _sum: { amount: true },
      _count: true,
    });
    return {
      totalWithdrawn: result._sum.amount ?? new Prisma.Decimal(0),
      count: result._count,
    };
  }
  private where(filters: WithdrawalFiltersDto) {
    return filters.from || filters.to
      ? { withdrawnAt: { gte: filters.from, lte: filters.to } }
      : {};
  }
  private range(filters: WithdrawalFiltersDto) {
    if (filters.from && filters.to && filters.from > filters.to)
      throw new BadRequestException('from must be before to');
  }
}
