import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InventoryAvailabilityService } from '../inventory/inventory-availability.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  PHONE_CASE_POLAROID_ADD_ON_PRICE,
  PhoneCasePackage,
} from '../inventory/order-item-calculation';
import { ProductCategory } from '../generated/prisma/client';

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
    const addOnAvailability = await this.phoneCaseAddOnAvailability();

    return products.map((product) =>
      this.toPublicProduct(product, availabilityMap, addOnAvailability),
    );
  }

  async findOnePublic(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true },
      include: { variants: { where: { isActive: true } } },
    });
    if (!product)
      throw new NotFoundException(`Product with ID "${id}" was not found`);
    const availabilityMap =
      await this.inventoryAvailability.getVariantAvailability(
        product.variants.map((variant) => variant.id),
      );
    return this.toPublicProduct(
      product,
      availabilityMap,
      await this.phoneCaseAddOnAvailability(),
    );
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

  private toPublicProduct(
    product: Awaited<ReturnType<PrismaService['product']['findFirst']>> & {
      variants: Array<{
        id: string;
        name: string;
        sku: string;
        sellingPrice: unknown;
        tracksStock: boolean;
        isActive: boolean;
      }>;
    },
    availabilityMap: Map<
      string,
      {
        inStock: boolean;
        availableQuantity: number | null;
        reasonIfUnavailable: string | null;
      }
    >,
    addOnAvailability: {
      inStock: boolean;
      availableQuantity: number;
      reasonIfUnavailable: string | null;
    },
  ) {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category: product.category,
      variants: product.variants.map((variant) => {
        const availability = availabilityMap.get(variant.id);
        const publicAvailability = {
          inStock: availability?.inStock ?? true,
          availableQuantity: availability?.availableQuantity ?? null,
          reasonIfUnavailable:
            availability?.inStock === false ? 'Temporarily unavailable' : null,
        };
        const basePrice = Number(variant.sellingPrice);
        const withPolaroidQuantity =
          publicAvailability.availableQuantity === null
            ? addOnAvailability.availableQuantity
            : Math.min(
                publicAvailability.availableQuantity,
                addOnAvailability.availableQuantity,
              );
        const withPolaroidAvailability = {
          inStock: publicAvailability.inStock && addOnAvailability.inStock,
          availableQuantity: withPolaroidQuantity,
          reasonIfUnavailable:
            publicAvailability.inStock && addOnAvailability.inStock
              ? null
              : 'Temporarily unavailable',
        };
        return {
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          sellingPrice: basePrice.toFixed(2),
          tracksStock: variant.tracksStock,
          ...publicAvailability,
          ...(product.category === ProductCategory.PHONE_CASE
            ? {
                packageOptions: [
                  {
                    code: PhoneCasePackage.CASE_ONLY,
                    sellingPrice: basePrice.toFixed(2),
                    ...publicAvailability,
                  },
                  {
                    code: PhoneCasePackage.WITH_POLAROID,
                    sellingPrice: (
                      basePrice + PHONE_CASE_POLAROID_ADD_ON_PRICE
                    ).toFixed(2),
                    ...withPolaroidAvailability,
                  },
                ],
              }
            : {}),
        };
      }),
    };
  }

  private async phoneCaseAddOnAvailability() {
    const resources = await this.prisma.resource.findMany({
      where: { sku: { in: ['FILM-SHEET', 'POLAROID-BOX'] } },
      select: { sku: true, currentStock: true, isActive: true },
    });
    const film = resources.find((resource) => resource.sku === 'FILM-SHEET');
    const box = resources.find((resource) => resource.sku === 'POLAROID-BOX');
    const availableQuantity = Math.max(
      0,
      Math.floor(
        Math.min(
          film?.isActive ? Number(film.currentStock) : 0,
          box?.isActive ? Number(box.currentStock) * 20 : 0,
        ),
      ),
    );
    return {
      inStock: availableQuantity > 0,
      availableQuantity,
      reasonIfUnavailable:
        availableQuantity > 0 ? null : 'Temporarily unavailable',
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
