import { BadRequestException } from '@nestjs/common';

import { ProductCategory } from '../generated/prisma/client';
import { PhoneCasePackage } from '../inventory/order-item-calculation';
import { OrderCustomizationService } from './order-customization.service';

describe('OrderCustomizationService', () => {
  const service = new OrderCustomizationService();
  const upload = (purpose: string, name: string) =>
    `https://api.example/api/uploads/files/${Buffer.from(`production/${purpose}/${name}`).toString('base64url')}`;
  const finalPngUrl = upload('polaroid_final', 'final.png');
  const previewUrl = upload('polaroid_preview', 'preview.png');

  it('keeps only Polaroid fulfillment files', () => {
    expect(
      service.normalize(ProductCategory.POLAROID, {
        finalPngUrl,
        previewUrl,
        zoom: 150,
        frontendPrice: 1,
      }),
    ).toEqual({
      finalPngUrl,
      previewUrl,
    });
  });

  it('rejects a Polaroid without its preview', () => {
    expect(() =>
      service.normalize(ProductCategory.POLAROID, {
        finalPngUrl,
      }),
    ).toThrow('Polaroid order requires previewUrl');
  });

  it('validates Photostrip and Vintage Letter production files', () => {
    expect(
      service.normalize(ProductCategory.PHOTOSTRIP, {
        finalPngUrl: upload('photostrip_final', 'strip.png'),
      }),
    ).toEqual({ finalPngUrl: upload('photostrip_final', 'strip.png') });

    expect(() => service.normalize(ProductCategory.VINTAGE_LETTER)).toThrow(
      'Vintage Letter order requires finalPdfUrl',
    );
  });

  it('accepts only supported phone-case packages', () => {
    expect(
      service.normalize(ProductCategory.PHONE_CASE, {
        package: PhoneCasePackage.WITH_POLAROID,
        finalPngUrl,
        previewUrl,
        price: 1,
      }),
    ).toEqual({
      package: PhoneCasePackage.WITH_POLAROID,
      finalPngUrl,
      previewUrl,
    });

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
