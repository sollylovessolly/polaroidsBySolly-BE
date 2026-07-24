import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';

@Injectable()
export class VariantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVariantDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product was not found');
    }

    const existingSku = await this.prisma.productVariant.findUnique({
      where: { sku: dto.sku },
    });

    if (existingSku) {
      throw new ConflictException(`Variant SKU "${dto.sku}" already exists`);
    }

    return this.prisma.productVariant.create({
      data: dto,
      include: {
        product: true,
      },
    });
  }

  async findAll(productId?: string) {
    return this.prisma.productVariant.findMany({
      where: {
        isActive: true,
        ...(productId ? { productId } : {}),
      },
      include: {
        product: true,
        supplier: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: {
        product: true,
        supplier: true,
        resourceRules: {
          include: {
            resource: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException(`Variant with ID "${id}" was not found`);
    }

    return variant;
  }

  async update(id: string, dto: UpdateVariantDto) {
    await this.findOne(id);

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      });

      if (!product || !product.isActive) {
        throw new NotFoundException('Product was not found');
      }
    }

    if (dto.sku) {
      const existingSku = await this.prisma.productVariant.findUnique({
        where: { sku: dto.sku },
      });

      if (existingSku && existingSku.id !== id) {
        throw new ConflictException(`Variant SKU "${dto.sku}" already exists`);
      }
    }

    return this.prisma.productVariant.update({
      where: { id },
      data: dto,
      include: {
        product: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.productVariant.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}