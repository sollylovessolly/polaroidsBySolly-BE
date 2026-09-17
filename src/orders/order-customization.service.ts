import { BadRequestException, Injectable } from '@nestjs/common';

import { ProductCategory } from '../generated/prisma/client';
import { PhoneCasePackage } from '../inventory/order-item-calculation';

type Customization = Record<string, unknown>;

@Injectable()
export class OrderCustomizationService {
  normalize(
    category: ProductCategory,
    customization?: Customization,
    requireFulfillment = true,
  ): Customization | undefined {
    switch (category) {
      case ProductCategory.POLAROID:
        return requireFulfillment
          ? {
              finalPngUrl: this.requireUpload(
                customization,
                'finalPngUrl',
                'Polaroid order requires finalPngUrl',
                'polaroid_final',
              ),
              previewUrl: this.requireUpload(
                customization,
                'previewUrl',
                'Polaroid order requires previewUrl',
                'polaroid_preview',
              ),
            }
          : this.pickOptional(customization, ['finalPngUrl', 'previewUrl']);
      case ProductCategory.PHOTOSTRIP:
        return requireFulfillment
          ? {
              finalPngUrl: this.requireUpload(
                customization,
                'finalPngUrl',
                'Photostrip order requires finalPngUrl',
                'photostrip_final',
              ),
            }
          : this.pickOptional(customization, ['finalPngUrl']);
      case ProductCategory.VINTAGE_LETTER:
        return requireFulfillment
          ? {
              finalPdfUrl: this.requireUpload(
                customization,
                'finalPdfUrl',
                'Vintage Letter order requires finalPdfUrl',
                'vintage_letter_final',
              ),
            }
          : this.pickOptional(customization, ['finalPdfUrl']);
      case ProductCategory.PHONE_CASE: {
        const packageOption = customization?.package;

        if (
          packageOption !== PhoneCasePackage.CASE_ONLY &&
          packageOption !== PhoneCasePackage.WITH_POLAROID
        ) {
          throw new BadRequestException(
            'Phone Case package must be CASE_ONLY or WITH_POLAROID',
          );
        }

        if (packageOption === PhoneCasePackage.CASE_ONLY) {
          return { package: packageOption };
        }

        return requireFulfillment
          ? {
              package: packageOption,
              finalPngUrl: this.requireUpload(
                customization,
                'finalPngUrl',
                'Phone Case with Polaroid requires finalPngUrl',
                'polaroid_final',
              ),
              previewUrl: this.requireUpload(
                customization,
                'previewUrl',
                'Phone Case with Polaroid requires previewUrl',
                'polaroid_preview',
              ),
            }
          : {
              package: packageOption,
              ...this.pickOptional(customization, [
                'finalPngUrl',
                'previewUrl',
              ]),
            };
      }
      case ProductCategory.ALBUM:
        return undefined;
    }
  }

  private requireString(
    customization: Customization | undefined,
    field: string,
    message: string,
  ) {
    const value = customization?.[field];

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(message);
    }

    return value.trim();
  }

  private requireUrl(
    customization: Customization | undefined,
    field: string,
    message: string,
  ) {
    const value = this.requireString(customization, field, message);
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
        throw new Error();
    } catch {
      throw new BadRequestException(`${field} must be a valid HTTP URL`);
    }
    return value;
  }

  private requireUpload(
    customization: Customization | undefined,
    field: string,
    message: string,
    purposePath: string,
  ) {
    const value = this.requireUrl(customization, field, message);
    const parsed = new URL(value);
    const match = parsed.pathname.match(/\/api\/uploads\/files\/([^/]+)$/);
    if (!match)
      throw new BadRequestException(`${field} must be a backend upload`);
    let key = '';
    try {
      key = Buffer.from(match[1], 'base64url').toString('utf8');
    } catch {
      throw new BadRequestException(`${field} has an invalid upload token`);
    }
    if (!key.startsWith(`production/${purposePath}/`)) {
      throw new BadRequestException(`${field} has the wrong upload purpose`);
    }
    return value;
  }

  private pickOptional(
    customization: Customization | undefined,
    fields: string[],
  ) {
    if (!customization) return undefined;

    const result: Customization = {};
    for (const field of fields) {
      const value = customization[field];
      if (typeof value === 'string' && value.trim()) {
        result[field] = this.requireUrl(
          customization,
          field,
          `${field} is required`,
        );
      }
    }
    return Object.keys(result).length ? result : undefined;
  }
}
