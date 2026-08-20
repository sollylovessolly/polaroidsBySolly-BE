import 'dotenv/config';
import { randomBytes, scryptSync } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import {
  ConsumptionRule,
  PrismaClient,
  ProductCategory,
  ResourceCategory,
  DiscountType,
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

const PHONE_MODELS = [
  'iPhone 14',
  'iPhone 14 Plus',
  'iPhone 14 Pro',
  'iPhone 14 Pro Max',

  'iPhone 15',
  'iPhone 15 Plus',
  'iPhone 15 Pro',
  'iPhone 15 Pro Max',

  'iPhone 16',
  'iPhone 16 Plus',
  'iPhone 16 Pro',
  'iPhone 16 Pro Max',
];

function makeSku(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function upsertProducts() {
  console.log('🌱 Seeding products...');

  const products = {
    polaroids: await prisma.product.upsert({
      where: {
        slug: 'polaroids',
      },
      update: {
        name: 'Polaroids',
        description: 'Custom Polaroid prints made from customer photos.',
        category: ProductCategory.POLAROID,
        isActive: true,
      },
      create: {
        name: 'Polaroids',
        slug: 'polaroids',
        description: 'Custom Polaroid prints made from customer photos.',
        category: ProductCategory.POLAROID,
        isActive: true,
      },
    }),

    vintageLetters: await prisma.product.upsert({
      where: {
        slug: 'vintage-letters',
      },
      update: {
        name: 'Vintage Letters',
        description:
          'Personalised vintage letters available in three styles and two finishes.',
        category: ProductCategory.VINTAGE_LETTER,
        isActive: true,
      },
      create: {
        name: 'Vintage Letters',
        slug: 'vintage-letters',
        description:
          'Personalised vintage letters available in three styles and two finishes.',
        category: ProductCategory.VINTAGE_LETTER,
        isActive: true,
      },
    }),

    phoneCases: await prisma.product.upsert({
      where: {
        slug: 'phone-cases',
      },
      update: {
        name: 'Phone Cases',
        description:
          'Custom iPhone cases available as case-only or with a Polaroid.',
        category: ProductCategory.PHONE_CASE,
        isActive: true,
      },
      create: {
        name: 'Phone Cases',
        slug: 'phone-cases',
        description:
          'Custom iPhone cases available as case-only or with a Polaroid.',
        category: ProductCategory.PHONE_CASE,
        isActive: true,
      },
    }),

    albums: await prisma.product.upsert({
      where: {
        slug: 'albums',
      },
      update: {
        name: 'Albums',
        description: 'Photo albums for storing printed memories.',
        category: ProductCategory.ALBUM,
        isActive: true,
      },
      create: {
        name: 'Albums',
        slug: 'albums',
        description: 'Photo albums for storing printed memories.',
        category: ProductCategory.ALBUM,
        isActive: true,
      },
    }),

    photostrips: await prisma.product.upsert({
      where: {
        slug: 'photostrips',
      },
      update: {
        name: 'Photostrips',
        description: 'Custom photostrips available in five template styles.',
        category: ProductCategory.PHOTOSTRIP,
        isActive: true,
      },
      create: {
        name: 'Photostrips',
        slug: 'photostrips',
        description: 'Custom photostrips available in five template styles.',
        category: ProductCategory.PHOTOSTRIP,
        isActive: true,
      },
    }),
  };

  console.log('✅ Products seeded');

  return products;
}

async function upsertVariant(input: {
  productId: string;
  name: string;
  sku: string;
  sellingPrice: number;
  tracksStock?: boolean;
  outsourcedUnitCost?: number;
}) {
  return prisma.productVariant.upsert({
    where: {
      sku: input.sku,
    },
    update: {
      productId: input.productId,
      name: input.name,
      sellingPrice: input.sellingPrice,
      tracksStock: input.tracksStock ?? false,
      outsourcedUnitCost: input.outsourcedUnitCost ?? 0,
      isActive: true,
    },
    create: {
      productId: input.productId,
      name: input.name,
      sku: input.sku,
      sellingPrice: input.sellingPrice,
      tracksStock: input.tracksStock ?? false,
      outsourcedUnitCost: input.outsourcedUnitCost ?? 0,
      isActive: true,
    },
  });
}

async function upsertVariants(
  products: Awaited<ReturnType<typeof upsertProducts>>,
) {
  console.log('🌱 Seeding variants...');

  const polaroid = await upsertVariant({
    productId: products.polaroids.id,
    name: 'Standard Border',
    sku: 'POLAROID-STANDARD',
    sellingPrice: 3500,
  });

  const vintageLetterDefinitions = [
    {
      style: 'Rusted Petals',
      normalSku: 'VINTAGE-RUSTED-PETALS-NORMAL',
      burntSku: 'VINTAGE-RUSTED-PETALS-BURNT',
    },
    {
      style: 'Timeless Ember',
      normalSku: 'VINTAGE-TIMELESS-EMBER-NORMAL',
      burntSku: 'VINTAGE-TIMELESS-EMBER-BURNT',
    },
    {
      style: 'Amber',
      normalSku: 'VINTAGE-AMBER-NORMAL',
      burntSku: 'VINTAGE-AMBER-BURNT',
    },
  ];

  const vintageLetters = [];

  for (const definition of vintageLetterDefinitions) {
    const normal = await upsertVariant({
      productId: products.vintageLetters.id,
      name: `${definition.style} — Normal Edge`,
      sku: definition.normalSku,
      sellingPrice: 3500,
      tracksStock: false,

      // Replace with your actual vendor cost later.
      outsourcedUnitCost: 0,
    });

    const burnt = await upsertVariant({
      productId: products.vintageLetters.id,
      name: `${definition.style} — Burnt Edge`,
      sku: definition.burntSku,
      sellingPrice: 4000,
      tracksStock: false,

      // Vendor cost stays the same; extra ₦500 is for your burnt-edge work.
      outsourcedUnitCost: 0,
    });

    vintageLetters.push(normal, burnt);
  }

  const phoneCases = [];

  for (const phoneModel of PHONE_MODELS) {
    const sku = `PHONECASE-${makeSku(phoneModel)}`;

    const variant = await upsertVariant({
      productId: products.phoneCases.id,
      name: phoneModel,
      sku,
      sellingPrice: 5500,
      tracksStock: true,
    });

    phoneCases.push(variant);
  }

  const album = await upsertVariant({
    productId: products.albums.id,
    name: 'Standard Album',
    sku: 'ALBUM-STANDARD',
    sellingPrice: 5000,
    tracksStock: false,
  });

  const photostrips = [];

  for (let number = 1; number <= 5; number += 1) {
    const variant = await upsertVariant({
      productId: products.photostrips.id,
      name: `Photostrip ${number}`,
      sku: `PHOTOSTRIP-${number}`,
      sellingPrice: 4000,
      tracksStock: false,

      // Replace with the actual outsourced printing cost per strip.
      outsourcedUnitCost: 0,
    });

    photostrips.push(variant);
  }

  console.log('✅ Variants seeded');

  return {
    polaroid,
    vintageLetters,
    phoneCases,
    album,
    photostrips,
  };
}

async function upsertResource(input: {
  name: string;
  sku: string;
  category: ResourceCategory;
  unit: string;
  lowStockThreshold: number;
}) {
  return prisma.resource.upsert({
    where: {
      sku: input.sku,
    },
    update: {
      name: input.name,
      category: input.category,
      unit: input.unit,
      lowStockThreshold: input.lowStockThreshold,
      isActive: true,
    },
    create: {
      name: input.name,
      sku: input.sku,
      category: input.category,
      unit: input.unit,

      // Stock and costs should be added through restocks/purchases.
      currentStock: 0,
      averageUnitCost: 0,
      lowStockThreshold: input.lowStockThreshold,
      isActive: true,
    },
  });
}

async function upsertResources() {
  console.log('🌱 Seeding resources...');

  const resources = {
    filmSheet: await upsertResource({
      name: 'Instax Mini Film Sheet',
      sku: 'FILM-SHEET',
      category: ResourceCategory.MATERIAL,
      unit: 'SHEET',
      lowStockThreshold: 10,
    }),

    mailerBag: await upsertResource({
      name: 'Mailer Bag',
      sku: 'MAILER-BAG',
      category: ResourceCategory.PACKAGING,
      unit: 'PIECE',
      lowStockThreshold: 10,
    }),

    polaroidBox: await upsertResource({
      name: 'Polaroid Box',
      sku: 'POLAROID-BOX',
      category: ResourceCategory.PACKAGING,
      unit: 'PIECE',
      lowStockThreshold: 5,
    }),

    letterEnvelope: await upsertResource({
      name: 'Vintage Letter Envelope',
      sku: 'LETTER-ENVELOPE',
      category: ResourceCategory.PACKAGING,
      unit: 'PIECE',
      lowStockThreshold: 5,
    }),

    phoneCaseCard: await upsertResource({
      name: 'Phone Case Card',
      sku: 'PHONECASE-CARD',
      category: ResourceCategory.PACKAGING,
      unit: 'PIECE',
      lowStockThreshold: 10,
    }),

    sticker: await upsertResource({
      name: 'Sticker',
      sku: 'STICKER',
      category: ResourceCategory.CONSUMABLE,
      unit: 'PIECE',
      lowStockThreshold: 20,
    }),

    thankYouCard: await upsertResource({
      name: 'Thank You Card',
      sku: 'THANKYOU-CARD',
      category: ResourceCategory.PACKAGING,
      unit: 'PIECE',
      lowStockThreshold: 10,
    }),
  };

  const blankPhoneCases = new Map<
    string,
    Awaited<ReturnType<typeof upsertResource>>
  >();

  for (const phoneModel of PHONE_MODELS) {
    const resource = await upsertResource({
      name: `Blank ${phoneModel} Case`,
      sku: `BLANK-${makeSku(phoneModel)}-CASE`,
      category: ResourceCategory.FINISHED_GOOD,
      unit: 'PIECE',
      lowStockThreshold: 2,
    });

    blankPhoneCases.set(phoneModel, resource);
  }

  console.log('✅ Resources seeded');

  return {
    ...resources,
    blankPhoneCases,
  };
}

async function ensureProductResourceRule(input: {
  variantId: string;
  resourceId: string;
  rule: ConsumptionRule;
  quantity: number;
  capacity?: number;
  usageGroup?: string;
}) {
  const existing = await prisma.productResourceRule.findFirst({
    where: {
      variantId: input.variantId,
      resourceId: input.resourceId,
    },
  });

  if (existing) {
    return prisma.productResourceRule.update({
      where: {
        id: existing.id,
      },
      data: {
        rule: input.rule,
        quantity: input.quantity,
        capacity: input.capacity,
        usageGroup: input.usageGroup,
      },
    });
  }

  return prisma.productResourceRule.create({
    data: input,
  });
}

async function ensureOrderResourceRule(input: {
  resourceId: string;
  quantity: number;
}) {
  const existing = await prisma.orderResourceRule.findFirst({
    where: {
      resourceId: input.resourceId,
    },
  });

  if (existing) {
    return prisma.orderResourceRule.update({
      where: {
        id: existing.id,
      },
      data: {
        quantity: input.quantity,
        isActive: true,
      },
    });
  }

  return prisma.orderResourceRule.create({
    data: {
      resourceId: input.resourceId,
      quantity: input.quantity,
      isActive: true,
    },
  });
}

async function seedResourceRules(
  variants: Awaited<ReturnType<typeof upsertVariants>>,
  resources: Awaited<ReturnType<typeof upsertResources>>,
) {
  console.log('🌱 Seeding resource rules...');

  await ensureProductResourceRule({
    variantId: variants.polaroid.id,
    resourceId: resources.filmSheet.id,
    rule: ConsumptionRule.PER_UNIT,
    quantity: 1,
    usageGroup: 'POLAROID_PRINT',
  });

  await ensureProductResourceRule({
    variantId: variants.polaroid.id,
    resourceId: resources.polaroidBox.id,
    rule: ConsumptionRule.CAPACITY,
    quantity: 1,
    capacity: 20,
    usageGroup: 'POLAROID_PRINT',
  });

  for (const vintageVariant of variants.vintageLetters) {
    await ensureProductResourceRule({
      variantId: vintageVariant.id,
      resourceId: resources.letterEnvelope.id,
      rule: ConsumptionRule.PER_UNIT,
      quantity: 1,
    });
  }

  for (const phoneCaseVariant of variants.phoneCases) {
    const blankCase = resources.blankPhoneCases.get(phoneCaseVariant.name);

    if (!blankCase) {
      throw new Error(
        `Blank phone-case resource missing for ${phoneCaseVariant.name}`,
      );
    }

    await ensureProductResourceRule({
      variantId: phoneCaseVariant.id,
      resourceId: blankCase.id,
      rule: ConsumptionRule.PER_UNIT,
      quantity: 1,
    });

    await ensureProductResourceRule({
      variantId: phoneCaseVariant.id,
      resourceId: resources.phoneCaseCard.id,
      rule: ConsumptionRule.PER_UNIT,
      quantity: 1,
    });
  }

  await ensureOrderResourceRule({
    resourceId: resources.mailerBag.id,
    quantity: 1,
  });

  await ensureOrderResourceRule({
    resourceId: resources.thankYouCard.id,
    quantity: 1,
  });

  await ensureOrderResourceRule({
    resourceId: resources.sticker.id,
    quantity: 2,
  });

  console.log('✅ Resource rules seeded');
}

async function main(): Promise<void> {
  console.log('🌱 Starting PolaroidsBySolly database seed...');

  const products = await upsertProducts();
  const variants = await upsertVariants(products);
  const resources = await upsertResources();

  await seedResourceRules(variants, resources);

  await prisma.deliveryRate.upsert({
    where: { normalizedState: 'lagos' },
    update: { state: 'Lagos', fee: 3800, isActive: true },
    create: {
      state: 'Lagos',
      normalizedState: 'lagos',
      fee: 3800,
      isActive: true,
    },
  });

  await prisma.discountCode.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: {
      code: 'WELCOME10',
      type: DiscountType.PERCENTAGE,
      value: 10,
      minimumOrderAmount: 5000,
      isActive: false,
    },
  });
  await prisma.discountCode.upsert({
    where: { code: 'SOLLY500' },
    update: {},
    create: {
      code: 'SOLLY500',
      type: DiscountType.FIXED,
      value: 500,
      isActive: false,
    },
  });

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const salt = randomBytes(16);
    const passwordHash = `scrypt$${salt.toString('base64url')}$${scryptSync(
      adminPassword,
      salt,
      64,
    ).toString('base64url')}`;
    await prisma.admin.upsert({
      where: { email: adminEmail },
      update: {
        name: process.env.ADMIN_NAME ?? 'Owner',
        passwordHash,
        isActive: true,
      },
      create: {
        email: adminEmail,
        name: process.env.ADMIN_NAME ?? 'Owner',
        passwordHash,
        isActive: true,
      },
    });
  }

  console.log('🎉 PolaroidsBySolly database seed completed');
}

main()
  .catch((error: unknown) => {
    console.error('❌ Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
