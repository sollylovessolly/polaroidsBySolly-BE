import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SupplierFiltersDto } from './dto/supplier-filters.dto';
import { paginated, pagination } from '../common/dto/pagination.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        note: dto.note,
      },
    });
  }

  async findAll(filters: SupplierFiltersDto = {}) {
    const search = filters.search?.trim();
    const where = {
      isActive: filters.inactive ? false : true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const { page, limit, skip, take } = pagination(filters);
    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
        skip,
        take,
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return paginated(data, total, page, limit);
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: {
        id,
      },
      include: {
        purchases: {
          orderBy: {
            purchasedAt: 'desc',
          },
          take: 20,
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID "${id}" was not found`);
    }

    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);

    return this.prisma.supplier.update({
      where: {
        id,
      },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.supplier.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }
}
