import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const KOBO = (naira: number) => Math.round(naira * 100);

async function main() {
  const passwordHash = bcrypt.hashSync('Password123!', 10);

  const existing = await prisma.user.findUnique({ where: { email: 'demo@voicefirst.dev' } });
  if (existing) {
    console.log('Seed already applied (demo user exists).');
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: 'demo@voicefirst.dev',
      phone: '+2348000000001',
      passwordHash,
      fullName: 'Demo Trader',
      status: 'ACTIVE',
      verifiedAt: new Date(),
    },
  });

  const business = await prisma.business.create({
    data: {
      ownerId: user.id,
      name: 'Tiara Provision Store',
      category: 'PROVISION_STORE',
      country: 'NG',
      currency: 'NGN',
      timezone: 'Africa/Lagos',
      preferredLanguage: 'en',
      onboardingStatus: 'COMPLETED',
    },
  });

  const rice = await prisma.product.create({
    data: {
      businessId: business.id,
      name: 'Rice',
      description: 'Foreign rice',
      defaultUnit: 'bag',
      sellingPriceKobo: KOBO(15000),
      costPriceKobo: KOBO(14000),
      openingStock: 15,
      currentStock: 15,
      lowStockThreshold: 5,
      aliases: {
        create: [{ alias: 'bag of rice' }, { alias: 'foreign rice' }, { alias: 'rice bag' }],
      },
      movements: {
        create: [
          {
            businessId: business.id,
            intent: 'STOCK_IN',
            quantityDelta: 15,
            quantityAfter: 15,
            note: 'Opening stock (seed)',
          },
        ],
      },
    },
  });

  const coke = await prisma.product.create({
    data: {
      businessId: business.id,
      name: 'Coca-Cola 50cl',
      defaultUnit: 'bottle',
      sellingPriceKobo: KOBO(700),
      costPriceKobo: KOBO(550),
      openingStock: 48,
      currentStock: 48,
      lowStockThreshold: 12,
      aliases: {
        create: [{ alias: 'coke' }, { alias: 'coca' }, { alias: 'coke bottle' }],
      },
      movements: {
        create: [
          {
            businessId: business.id,
            intent: 'STOCK_IN',
            quantityDelta: 48,
            quantityAfter: 48,
            note: 'Opening stock (seed)',
          },
        ],
      },
    },
  });

  const garri = await prisma.product.create({
    data: {
      businessId: business.id,
      name: 'Garri',
      defaultUnit: 'paint rubber',
      sellingPriceKobo: KOBO(5000),
      costPriceKobo: null,
      openingStock: 20,
      currentStock: 20,
      lowStockThreshold: 5,
      aliases: {
        create: [{ alias: 'gari' }, { alias: 'paint rubber of garri' }],
      },
      movements: {
        create: [
          {
            businessId: business.id,
            intent: 'STOCK_IN',
            quantityDelta: 20,
            quantityAfter: 20,
            note: 'Opening stock (seed)',
          },
        ],
      },
    },
  });

  const aisha = await prisma.debtor.create({
    data: {
      businessId: business.id,
      name: 'Aisha',
      phone: '+2348000000002',
      outstandingBalanceKobo: KOBO(25000),
    },
  });

  await prisma.dailySummary.create({
    data: {
      businessId: business.id,
      date: new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'),
      revenueKobo: 0,
      cogsKobo: 0,
      grossProfitKobo: 0,
      expensesKobo: 0,
      netProfitKobo: 0,
      transactionCount: 0,
    },
  });

  console.log('Seed complete.');
  console.log('  Login: demo@voicefirst.dev / Password123!');
  console.log(`  Business: ${business.name}`);
  console.log(`  Products: ${rice.name} (${rice.currentStock} bags), ${coke.name} (${coke.currentStock} bottles), ${garri.name} (${garri.currentStock} paint rubbers)`);
  console.log(`  Debtor: ${aisha.name} owes ₦${(aisha.outstandingBalanceKobo / 100).toLocaleString()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });