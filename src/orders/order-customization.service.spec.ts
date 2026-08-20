import { BadRequestException } from '@nestjs/common';

import { ProductCategory } from '../generated/prisma/client';
import { PhoneCasePackage } from '../inventory/order-item-calculation';
import { OrderCustomizationService } from './order-customization.service';

describe('OrderCustomizationService', () => {
  const service = new OrderCustomizationService();

  it('keeps only Polaroid fulfillment files', () => {
    expect(
      service.normalize(ProductCategory.POLAROID, {
        finalPngUrl: 'https://storage/final.png',
        previewUrl: 'https://storage/preview.png',
        zoom: 150,
        frontendPrice: 1,
      }),
    ).toEqual({
      finalPngUrl: 'https://storage/final.png',
      previewUrl: 'https://storage/preview.png',
    });
  });

  it('rejects a Polaroid without its preview', () => {
    expect(() =>
      service.normalize(ProductCategory.POLAROID, {
        finalPngUrl: 'https://storage/final.png',
      }),
    ).toThrow('Polaroid order requires previewUrl');
  });

  it('validates Photostrip and Vintage Letter production files', () => {
    expect(
      service.normalize(ProductCategory.PHOTOSTRIP, {
        finalPngUrl: 'https://storage/strip.png',
      }),
    ).toEqual({ finalPngUrl: 'https://storage/strip.png' });

    expect(() => service.normalize(ProductCategory.VINTAGE_LETTER)).toThrow(
      'Vintage Letter order requires finalPdfUrl',
    );
  });

  it('accepts only supported phone-case packages', () => {
    expect(
      service.normalize(ProductCategory.PHONE_CASE, {
        package: PhoneCasePackage.WITH_POLAROID,
        price: 1,
      }),
    ).toEqual({ package: PhoneCasePackage.WITH_POLAROID });

    expect(() =>
      service.normalize(ProductCategory.PHONE_CASE, { package: 'OTHER' }),
    ).toThrow(BadRequestException);
  });

  it('does not invent Album customization', () => {
    expect(
      service.normalize(ProductCategory.ALBUM, { arbitrary: true }),
    ).toBeUndefined();
  });

  it('allows manual production files to be attached later', () => {
    expect(
      service.normalize(ProductCategory.POLAROID, undefined, false),
    ).toBeUndefined();
    expect(
      service.normalize(
        ProductCategory.POLAROID,
        { previewUrl: 'https://storage/preview.png', editorState: {} },
        false,
      ),
    ).toEqual({ previewUrl: 'https://storage/preview.png' });
  });
});
