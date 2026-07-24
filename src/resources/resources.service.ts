import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateResourceDto) {
    const existingResource = await this.prisma.resource.findUnique({
      where: {
        sku: dto.sku,
      },
    });

    if (existingResource) {
      throw new ConflictException(
        `A resource with SKU "${dto.sku}" already exists`,
      );
    }

    return this.prisma.resource.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        category: dto.category,
        unit: dto.unit,
        currentStock: dto.currentStock ?? 0,
        averageUnitCost: dto.averageUnitCost ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(lowStock?: boolean) {
    const resources = await this.prisma.resource.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    if (!lowStock) {
      return resources;
    }

    return resources.filter(
      (resource) =>
        Number(resource.currentStock) <=
        Number(resource.lowStockThreshold),
    );
  }

  async findOne(id: string) {
    const resource = await this.prisma.resource.findUnique({
      where: {
        id,
      },
      include: {
        movements: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 20,
        },
      },
    });

    if (!resource) {
      throw new NotFoundException(
        `Resource with ID "${id}" was not found`,
      );
    }

    return resource;
  }

  async update(id: string, dto: UpdateResourceDto) {
    await this.findOne(id);

    if (dto.sku) {
      const existingResource = await this.prisma.resource.findUnique({
        where: {
          sku: dto.sku,
        },
      });

      if (existingResource && existingResource.id !== id) {
        throw new ConflictException(
          `A resource with SKU "${dto.sku}" already exists`,
        );
      }
    }

    return this.prisma.resource.update({
      where: {
        id,
      },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.resource.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }
}