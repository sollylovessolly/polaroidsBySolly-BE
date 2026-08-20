import { ProductCategory } from '../generated/prisma/client';

export enum PhoneCasePackage {
  CASE_ONLY = 'CASE_ONLY',
  WITH_POLAROID = 'WITH_POLAROID',
}

export type CalculatedOrderItemInput = {
  variantId: string;
  variantSku: string;
  productCategory?: ProductCategory;
  quantity: number;
  customization?: unknown;
};

export const PHONE_CASE_POLAROID_ADD_ON_PRICE = 3500;
