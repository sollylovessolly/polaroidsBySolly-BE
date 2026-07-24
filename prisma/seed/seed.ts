import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  ProductCategory,
} from '../../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing from your .env file');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function seedProducts(): Promise<void> {
  console.log('🌱 Seeding products...');

  const result = await prisma.product.createMany({
    data: [
      {
        name: 'Polaroids',
        slug: 'polaroids',
        description: 'Custom Polaroid prints created from customer photos.',
        category: ProductCategory.POLAROID,
        isActive: true,
      },
      {
        name: 'Phone Cases',
        slug: 'phone-cases',
        description:
          'Custom phone cases available as case-only or with a Polaroid print.',
        category: ProductCategory.PHONE_CASE,
        isActive: true,
      },
      {
        name: 'Photostrips',
        slug: 'photostrips',
        description:
          'Custom photostrips created using customer-selected designs and photos.',
        category: ProductCategory.PHOTOSTRIP,
        isActive: true,
      },
      {
        name: 'Vintage Letters',
        slug: 'vintage-letters',
        description:
          'Personalised vintage letters available with normal or burnt edges.',
        category: ProductCategory.VINTAGE_LETTER,
        isActive: true,
      },
      {
        name: 'Albums',
        slug: 'albums',
        description: 'Photo albums for preserving printed memories.',
        category: ProductCategory.ALBUM,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Products seeded. ${result.count} new product(s) created.`);
}

async function main(): Promise<void> {
  console.log('🌱 Starting database seed...');

  await seedProducts();

  console.log('✅ Database seed completed successfully.');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });