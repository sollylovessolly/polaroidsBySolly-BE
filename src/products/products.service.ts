import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InventoryAvailabilityService } from '../inventory/inventory-availability.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryAvailability: InventoryAvailabilityService,
  ) {}

  async create(createProductDto: CreateProductDto) {
    const existingProduct = await this.prisma.product.findUnique({
      where: {
        slug: createProductDto.slug,
      },
    });

    if (existingProduct) {
      throw new ConflictException(
        `A product with slug "${createProductDto.slug}" already exists`,
      );
    }

    return this.prisma.product.create({
      data: createProductDto,
    });
  }

  async findAll() {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        variants: {
          where: {
            isActive: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const variantIds = products.flatMap((product) =>
      product.variants.map((variant) => variant.id),
    );

    const availabilityMap =
      await this.inventoryAvailability.getVariantAvailability(variantIds);

    return products.map((product) => ({
      ...product,

      variants: product.variants.map((variant) => {
        const availability = availabilityMap.get(variant.id);

        return {
          ...variant,

          inStock: availability?.inStock ?? true,

          availableQuantity: availability?.availableQuantity ?? null,

          reasonIfUnavailable: availability?.reasonIfUnavailable ?? null,
        };
      }),
    }));
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" was not found`);
    }

    const availabilityMap =
      await this.inventoryAvailability.getVariantAvailability(
        product.variants.map((variant) => variant.id),
      );

    return {
      ...product,

      variants: product.variants.map((variant) => {
        const availability = availabilityMap.get(variant.id);

        return {
          ...variant,

          inStock: availability?.inStock ?? true,

          availableQuantity: availability?.availableQuantity ?? null,

          reasonIfUnavailable: availability?.reasonIfUnavailable ?? null,
        };
      }),
    };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);

    if (updateProductDto.slug) {
      const productWithSlug = await this.prisma.product.findUnique({
        where: {
          slug: updateProductDto.slug,
        },
      });

      if (productWithSlug && productWithSlug.id !== id) {
        throw new ConflictException(
          `A product with slug "${updateProductDto.slug}" already exists`,
        );
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
