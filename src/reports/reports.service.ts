import { Injectable } from '@nestjs/common';
import { TransactionIntent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { enumMap } from '../common/enums';

const DAY_MS = 86_400_000;

export interface DailySummaryInput {
  businessId: string;
  date: string; // YYYY-MM-DD (business-local day, stored normalized to UTC midnight)
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(businessId: string) {
    const day = this.dateStr(new Date());
    const today = await this.computeDailySummary({ businessId, date: day });

    const [productCount, debtorCount, outstandingBalance, pendingCount, recentTransactions, lowStock] =
      await Promise.all([
        this.prisma.product.count({ where: { businessId, status: 'ACTIVE' } }),
        this.prisma.debtor.count({ where: { businessId, status: 'ACTIVE' } }),
        this.prisma.debtor.aggregate({ where: { businessId }, _sum: { outstandingBalanceKobo: true } }),
        this.prisma.pendingConfirmation.count({ where: { businessId, status: 'PENDING' } }),
        this.prisma.transaction.findMany({
          where: { businessId, status: 'CONFIRMED' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            type: true,
            totalKobo: true,
            note: true,
            createdAt: true,
          },
        }),
        this.prisma.product.findMany({
          where: {
            businessId,
            status: 'ACTIVE',
            lowStockThreshold: { not: null },
          },
          take: 25,
          select: {
            id: true,
            name: true,
            defaultUnit: true,
            currentStock: true,
            lowStockThreshold: true,
          },
        }),
      ]);

    const lowStockFiltered = lowStock.filter(
      (p) => p.lowStockThreshold != null && Number(p.currentStock) <= Number(p.lowStockThreshold),
    );

    return {
      today,
      counts: { products: productCount, activeDebtors: debtorCount, pendingConfirmations: pendingCount },
      outstandingDebtKobo: outstandingBalance._sum.outstandingBalanceKobo ?? 0,
      recentTransactions: recentTransactions.map((t) => ({
        ...t,
        type: enumMap.intentFromDb(t.type),
      })),
      lowStockProducts: lowStockFiltered.map((p) => ({
        ...p,
        currentStock: p.currentStock.toString(),
        lowStockThreshold: p.lowStockThreshold?.toString() ?? null,
      })),
    };
  }

  async computeDailySummary(input: DailySummaryInput) {
    const { businessId, date } = input;
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    const sales = await this.prisma.transaction.findMany({
      where: {
        businessId,
        status: 'CONFIRMED',
        type: TransactionIntent.SALE,
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      include: {
        items: { select: { quantity: true, costPriceKobo: true, productId: true } },
      },
    });

    const revenueKobo = sales.reduce((sum, t) => sum + t.totalKobo, 0);
    const cogsKobo = sales.reduce(
      (sum, t) =>
        sum +
        t.items.reduce(
          (s, i) => s + (i.productId && i.costPriceKobo != null ? Math.round(Number(i.quantity) * i.costPriceKobo) : 0),
          0,
        ),
      0,
    );

    const expensesAgg = await this.prisma.transaction.aggregate({
      where: {
        businessId,
        status: 'CONFIRMED',
        type: TransactionIntent.EXPENSE,
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      _sum: { totalKobo: true },
    });
    const expensesKobo = expensesAgg._sum.totalKobo ?? 0;

    const grossProfitKobo = revenueKobo - cogsKobo;
    const netProfitKobo = grossProfitKobo - expensesKobo;

    return this.prisma.dailySummary.upsert({
      where: { businessId_date: { businessId, date: dayStart } },
      create: {
        businessId,
        date: dayStart,
        revenueKobo,
        cogsKobo,
        grossProfitKobo,
        expensesKobo,
        netProfitKobo,
        transactionCount: sales.length,
        details: { sales: sales.length },
      },
      update: {
        revenueKobo,
        cogsKobo,
        grossProfitKobo,
        expensesKobo,
        netProfitKobo,
        transactionCount: sales.length,
        details: { sales: sales.length },
      },
    });
  }

  async trend(businessId: string, days: number) {
    const out: Array<{ date: string; revenueKobo: number; transactionCount: number }> = [];
    for (let offset = days - 1; offset >= 0; offset--) {
      const d = new Date(Date.now() - offset * DAY_MS);
      const date = this.dateStr(d);
      const summary = await this.prisma.dailySummary.findUnique({
        where: { businessId_date: { businessId, date: new Date(`${date}T00:00:00.000Z`) } },
      });
      out.push({
        date,
        revenueKobo: summary?.revenueKobo ?? 0,
        transactionCount: summary?.transactionCount ?? 0,
      });
    }
    return out;
  }

  async profitLoss(businessId: string, from: string, to: string) {
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T00:00:00.000Z`);
    const toEnd = new Date(toDate.getTime() + DAY_MS);

    const agg = (type: TransactionIntent) =>
      this.prisma.transaction.aggregate({
        where: {
          businessId,
          status: 'CONFIRMED',
          type,
          createdAt: { gte: fromDate, lt: toEnd },
        },
        _sum: { totalKobo: true },
        _count: true,
      });

    const [sales, purchases, expenses, payments] = await Promise.all([
      agg(TransactionIntent.SALE),
      agg(TransactionIntent.PURCHASE),
      agg(TransactionIntent.EXPENSE),
      agg(TransactionIntent.PAYMENT),
    ]);

    const salesItems = await this.prisma.transactionItem.findMany({
      where: {
        businessId,
        transaction: {
          status: 'CONFIRMED',
          type: TransactionIntent.SALE,
          createdAt: { gte: fromDate, lt: toEnd },
        },
        productId: { not: null },
        costPriceKobo: { not: null },
      },
    });
    const cogsKobo = salesItems.reduce(
      (sum, i) => sum + Math.round(Number(i.quantity) * (i.costPriceKobo ?? 0)),
      0,
    );

    const revenueKobo = sales._sum.totalKobo ?? 0;
    const expensesKobo = expenses._sum.totalKobo ?? 0;
    const purchasesKobo = purchases._sum.totalKobo ?? 0;
    const paymentsCollectedKobo = payments._sum.totalKobo ?? 0;

    return {
      from,
      to,
      revenueKobo,
      cogsKobo,
      grossProfitKobo: revenueKobo - cogsKobo,
      expensesKobo,
      netProfitKobo: revenueKobo - cogsKobo - expensesKobo,
      purchasesKobo,
      paymentsCollectedKobo,
      counts: {
        sales: sales._count,
        purchases: purchases._count,
        expenses: expenses._count,
        payments: payments._count,
      },
    };
  }

  private dateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
  }
}