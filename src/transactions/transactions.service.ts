import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PaymentMethod, StockMovementKind, TransactionIntent, TransactionSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { ConfirmationBlockedError, DomainError } from '../common/errors/domain-errors';
import { enumMap } from '../common/enums';
import { CreateTransactionInput, ListTransactionsInput } from './transactions.schemas';

export interface CommitItem {
  productId?: string | null;
  quantity: number;
  unit: string;
  name?: string | null;
  unitPriceKobo?: number | null;
  lineTotalKobo?: number | null;
  costPriceKobo?: number | null;
}

export interface CommitInput {
  businessId: string;
  userId: string;
  type: TransactionIntent;
  source: TransactionSource;
  items: CommitItem[];
  totalKobo?: number | null;
  paymentMethod?: PaymentMethod | null;
  counterparty?: string | null;
  debtorId?: string | null;
  debtorName?: string | null;
  debtorPhone?: string | null;
  note?: string | null;
  occurredAt?: Date | null;
  idempotencyKey?: string | null;
}

const STOCK_MOVEMENT_KIND: Partial<Record<TransactionIntent, StockMovementKind>> = {
  SALE: StockMovementKind.SALE,
  PURCHASE: StockMovementKind.PURCHASE,
  STOCK_IN: StockMovementKind.STOCK_IN,
};

const AFFECTS_DEBTOR: TransactionIntent[] = [
  TransactionIntent.SALE,
  TransactionIntent.DEBT,
  TransactionIntent.PAYMENT,
];

const DETAILED_INCLUDE = {
  items: {
    include: { product: { select: { id: true, name: true, defaultUnit: true } } },
  },
  debtor: true,
  stockMovements: true,
  pendingConfirmation: { select: { id: true } },
} satisfies Prisma.TransactionInclude;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  /** Convenience wrapper for manual / API-originated transaction creation. */
  async create(input: {
    businessId: string;
    userId: string;
    body: CreateTransactionInput;
    idempotencyKey?: string | null;
  }): Promise<unknown> {
    const { businessId, userId, body, idempotencyKey } = input;

    if (idempotencyKey) {
      const existing = await this.prisma.transaction.findUnique({
        where: { idempotencyKey },
        include: DETAILED_INCLUDE,
      });
      if (existing) {
        return { transaction: this.toDto(existing), idempotentReplay: true };
      }
    }

    const committed = await this.commit({
      businessId,
      userId,
      type: enumMap.intentToDb(body.type),
      source: TransactionSource.MANUAL,
      items: body.items.map((item) => ({
        productId: item.productId ?? null,
        quantity: item.quantity,
        unit: item.unit,
        name: item.name ?? null,
        unitPriceKobo: item.unitPriceKobo ?? null,
        lineTotalKobo: item.lineTotalKobo ?? null,
        costPriceKobo: item.costPriceKobo ?? null,
      })),
      totalKobo: body.totalKobo ?? null,
      paymentMethod: enumMap.paymentToDb(body.paymentMethod ?? null),
      counterparty: body.counterparty ?? null,
      debtorId: body.debtorId ?? null,
      debtorName: body.debtorName ?? null,
      debtorPhone: body.debtorPhone ?? null,
      note: body.note ?? null,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : null,
      idempotencyKey: idempotencyKey ?? null,
    });

    return { transaction: this.toDto(committed), idempotentReplay: false };
  }

  /**
   * Core transactional writer. Creates the transaction, its items, stock movements,
   * debtor balance changes and an audit event inside a single DB transaction (PRD §19).
   */
  async commit(input: CommitInput): Promise<Prisma.TransactionGetPayload<{ include: typeof DETAILED_INCLUDE }>> {
    const productIds = Array.from(
      new Set(input.items.map((i) => i.productId).filter((v): v is string => Boolean(v))),
    );

    const issues = await this.collectBlockingIssues(input, productIds);
    if (issues.length > 0) {
      if (input.source === TransactionSource.VOICE || input.source === TransactionSource.WHATSAPP) {
        throw new ConfirmationBlockedError(issues);
      }
      throw new BadRequestException({ code: 'TRANSACTION_INVALID', message: issues.join('. ') });
    }

    // Resolve reference data (products) once, before starting the write transaction.
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, businessId: input.businessId },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const totalKobo = (input.totalKobo ?? this.computeTotal(input, productMap)) ?? 0;

    try {
      const committed = await this.prisma.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            businessId: input.businessId,
            userId: input.userId,
            type: input.type,
            status: 'CONFIRMED',
            totalKobo,
            paymentMethod: input.paymentMethod ?? null,
            counterparty: input.counterparty ?? null,
            source: input.source,
            note: input.note ?? null,
            idempotencyKey: input.idempotencyKey ?? null,
            occurredAt: input.occurredAt ?? new Date(),
          },
          include: DETAILED_INCLUDE,
        });

        for (const item of input.items) {
          const product = item.productId ? productMap.get(item.productId) : undefined;
          const unitPriceKobo = item.unitPriceKobo ?? product?.sellingPriceKobo ?? null;
          const lineTotalKobo =
            item.lineTotalKobo ?? (unitPriceKobo !== null ? Math.round(item.quantity * unitPriceKobo) : null);
          const costPriceKobo = item.costPriceKobo ?? product?.costPriceKobo ?? null;

          await tx.transactionItem.create({
            data: {
              transactionId: transaction.id,
              businessId: input.businessId,
              productId: item.productId ?? null,
              name: item.name ?? product?.name ?? 'Unnamed',
              quantity: new Prisma.Decimal(item.quantity),
              unit: item.unit,
              unitPriceKobo,
              lineTotalKobo,
              costPriceKobo,
            },
          });

          const kind = STOCK_MOVEMENT_KIND[input.type];
          if (kind && item.productId && product) {
            const direction = input.type === TransactionIntent.SALE ? -1 : 1;
            await this.inventory.applyDelta(tx, {
              businessId: input.businessId,
              productId: item.productId,
              delta: item.quantity * direction,
              kind,
              transactionId: transaction.id,
              note: `${input.type.toLowerCase()} transaction ${transaction.id}`,
            });
          }

          // Track latest known purchase cost on the product.
          if (input.type === TransactionIntent.PURCHASE && item.productId && unitPriceKobo !== null) {
            await tx.product.update({
              where: { id: item.productId },
              data: { costPriceKobo: unitPriceKobo },
            });
          }
        }

        let debtorId: string | null = input.debtorId ?? null;
        if (AFFECTS_DEBTOR.includes(input.type)) {
          const debtorName = input.debtorName ?? this.resolveDebtorName(transaction.counterparty, input);
          if (!debtorId && !debtorName) {
            throw new DomainError(
              422,
              'CONFIRMATION_BLOCKED',
              'A credit sale, debt or payment requires a debtor',
            );
          }

          const direction =
            input.type === TransactionIntent.PAYMENT ? -1 : 1;
          const delta = totalKobo * direction;

          let debtor;
          if (debtorId) {
            debtor = await tx.debtor.findFirst({
              where: { id: debtorId, businessId: input.businessId },
            });
            if (!debtor) throw new NotFoundException('Debtor not found');
          } else {
            debtor = await tx.debtor.findFirst({
              where: { businessId: input.businessId, name: { equals: debtorName ?? 'Unknown debtor', mode: 'insensitive' } },
            });
          }

          if (debtor) {
            debtor = await tx.debtor.update({
              where: { id: debtor.id },
              data: {
                outstandingBalanceKobo: { increment: delta },
                status: debtor.outstandingBalanceKobo + delta <= 0 ? 'SETTLED' : 'ACTIVE',
              },
            });
          } else {
            debtor = await tx.debtor.create({
              data: {
                businessId: input.businessId,
                name: debtorName ?? 'Unknown debtor',
                phone: input.debtorPhone ?? null,
                outstandingBalanceKobo: delta,
                status: delta <= 0 ? 'SETTLED' : 'ACTIVE',
              },
            });
          }
          debtorId = debtor.id;

          if (input.type === TransactionIntent.PAYMENT) {
            await tx.debtPayment.create({
              data: {
                businessId: input.businessId,
                debtorId: debtor.id,
                transactionId: transaction.id,
                amountKobo: totalKobo,
                paymentMethod: input.paymentMethod ?? null,
                note: input.note ?? null,
                idempotencyKey: input.idempotencyKey
                  ? `payment:${input.idempotencyKey}`
                  : `payment-trans:${transaction.id}`,
              },
            });
          }

          await tx.transaction.update({
            where: { id: transaction.id },
            data: { debtorId },
          });
        }

        await this.audit.record(tx, {
          businessId: input.businessId,
          userId: input.userId,
          transactionId: transaction.id,
          action: 'transaction.created',
          entityType: 'transaction',
          entityId: transaction.id,
          meta: {
            type: input.type,
            totalKobo,
            source: input.source,
            items: input.items as unknown as Prisma.InputJsonValue,
          },
        });

        // Re-read with relations populated (stock movements + debtor).
        return tx.transaction.findUniqueOrThrow({ where: { id: transaction.id }, include: DETAILED_INCLUDE });
      });
      return committed;
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') {
        const existing = await this.prisma.transaction.findUniqueOrThrow({
          where: { idempotencyKey: input.idempotencyKey ?? '' },
          include: DETAILED_INCLUDE,
        });
        return existing;
      }
      throw err;
    }
  }

  /** Human-readable blocking reasons for a commit input (PRD §14.3). */
  private async collectBlockingIssues(
    input: CommitInput,
    _productIds: string[],
  ): Promise<string[]> {
    const issues: string[] = [];
    const isCreditSale =
      input.type === TransactionIntent.SALE && (input.paymentMethod === PaymentMethod.CREDIT || input.paymentMethod === PaymentMethod.PARTIAL);
    const isStockIntent =
      input.type === TransactionIntent.SALE ||
      input.type === TransactionIntent.PURCHASE ||
      input.type === TransactionIntent.STOCK_IN;

    if (isStockIntent) {
      if (input.items.length === 0) {
        issues.push('No product identified');
      }
      for (const item of input.items) {
        if (!item.productId) {
          issues.push(`Product "${item.name ?? 'unknown'}" could not be matched to your catalog`);
        }
        if (item.quantity === undefined || item.quantity === null || item.quantity <= 0) {
          issues.push(`Quantity is missing for "${item.name ?? 'unknown'}"`);
        }
      }
    }

    if (input.type === TransactionIntent.EXPENSE || input.type === TransactionIntent.DEBT || input.type === TransactionIntent.PAYMENT) {
      if (!input.totalKobo) {
        issues.push('The total cannot be calculated');
      }
    }
    if (input.type === TransactionIntent.DEBT || input.type === TransactionIntent.PAYMENT) {
      if (!input.debtorName && !input.debtorId && !input.counterparty) {
        issues.push('A debtor is required');
      }
    }
    if (isCreditSale) {
      if (!input.debtorName && !input.debtorId) {
        issues.push('A credit sale requires a debtor');
      }
    }
    return issues;
  }

  private computeTotal(
    input: CommitInput,
    productMap: Map<string, { sellingPriceKobo: number | null }>,
  ): number | null {
    if (input.type === TransactionIntent.EXPENSE || input.type === TransactionIntent.DEBT) {
      return input.totalKobo ?? null;
    }
    let sum = 0;
    let any = false;
    for (const item of input.items) {
      const price = item.unitPriceKobo ?? productMap.get(item.productId ?? '')?.sellingPriceKobo ?? null;
      const line = item.lineTotalKobo ?? (price !== null ? Math.round(item.quantity * price) : null);
      if (line === null) {
        return null;
      }
      sum += line;
      any = true;
    }
    return any ? sum : (input.totalKobo ?? null);
  }

  private resolveDebtorName(counterparty: string | null, input: CommitInput): string | null {
    return input.debtorName ?? counterparty ?? null;
  }

  async list(businessId: string, input: ListTransactionsInput) {
    const where: Prisma.TransactionWhereInput = { businessId };
    if (input.type) where.type = enumMap.intentToDb(input.type);
    if (input.from || input.to) {
      where.createdAt = {
        gte: input.from ? new Date(input.from) : undefined,
        lte: input.to ? new Date(input.to) : undefined,
      };
    }
    if (input.productId) {
      where.items = { some: { productId: input.productId } };
    }
    if (input.q) {
      where.OR = [
        { counterparty: { contains: input.q, mode: 'insensitive' } },
        { note: { contains: input.q, mode: 'insensitive' } },
        { items: { some: { name: { contains: input.q, mode: 'insensitive' } } } },
        { debtor: { name: { contains: input.q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          items: { include: { product: { select: { id: true, name: true, defaultUnit: true } } } },
          debtor: { select: { id: true, name: true } },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { items: items.map((t) => this.toDto(t)), total, page: input.page, pageSize: input.pageSize };
  }

  async getById(businessId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, businessId },
      include: DETAILED_INCLUDE,
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return this.toDto(transaction);
  }

  async reverse(businessId: string, userId: string, transactionId: string) {
    const original = await this.prisma.transaction.findFirst({
      where: { id: transactionId, businessId, status: 'CONFIRMED', reversedAt: null },
      include: { items: true },
    });
    if (!original) {
      throw new NotFoundException('Transaction not found or already reversed');
    }

    const reversal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          businessId,
          userId,
          type: original.type,
          status: 'CONFIRMED',
          totalKobo: original.totalKobo,
          paymentMethod: original.paymentMethod,
          counterparty: original.counterparty,
          debtorId: original.debtorId,
          source: TransactionSource.MANUAL,
          note: `Reversal of ${original.id}`,
          reverseOfId: original.id,
          idempotencyKey: `rev:${original.id}`,
          occurredAt: new Date(),
        },
        include: DETAILED_INCLUDE,
      });

      for (const item of original.items) {
        const deltaDirections: Partial<Record<TransactionIntent, number>> = {
          SALE: 1,
          PURCHASE: -1,
          STOCK_IN: -1,
        };
        const direction = deltaDirections[original.type];
        await tx.transactionItem.create({
          data: {
            transactionId: created.id,
            businessId,
            productId: item.productId,
            name: item.name,
            quantity: new Prisma.Decimal(item.quantity),
            unit: item.unit,
            unitPriceKobo: item.unitPriceKobo,
            lineTotalKobo: item.lineTotalKobo,
            costPriceKobo: item.costPriceKobo,
          },
        });
        if (direction !== undefined && item.productId) {
          await this.inventory.applyDelta(tx, {
            businessId,
            productId: item.productId,
            delta: new Prisma.Decimal(item.quantity).mul(direction),
            kind: StockMovementKind.REVERSAL,
            transactionId: created.id,
            note: `Reversal of ${original.id}`,
          });
        }
      }

      // Reverse debtor impact.
      const direction = original.type === TransactionIntent.PAYMENT ? 1 : -1;
      if (AFFECTS_DEBTOR.includes(original.type) && original.debtorId) {
        await tx.debtor.update({
          where: { id: original.debtorId },
          data: {
            outstandingBalanceKobo: { increment: original.totalKobo * direction },
            status: 'ACTIVE',
          },
        });
      }

      await tx.transaction.update({
        where: { id: original.id },
        data: { status: 'REVERSED', reversedAt: new Date(), reversedById: userId },
      });

      await this.audit.record(tx, {
        businessId,
        userId,
        transactionId: created.id,
        action: 'transaction.reversed',
        entityType: 'transaction',
        entityId: original.id,
      });

      return created;
    });

    return this.toDto(reversal);
  }

  /** Maps a raw Prisma transaction to the API DTO shape (api-style enums + numbers). */
  toDto(transaction: Prisma.TransactionGetPayload<{ include: typeof DETAILED_INCLUDE }> | Prisma.TransactionGetPayload<{ include: { items: true; debtor: true } }> | any): any {
    return {
      id: transaction.id,
      type: enumMap.intentFromDb(transaction.type),
      status: transaction.status,
      totalKobo: transaction.totalKobo,
      paymentMethod: enumMap.paymentFromDb(transaction.paymentMethod ?? null),
      counterparty: transaction.counterparty,
      debtor: transaction.debtor
        ? { id: transaction.debtor.id, name: transaction.debtor.name }
        : null,
      source: enumMap.sourceFromDb(transaction.source),
      note: transaction.note,
      stockImpact:
        transaction.stockMovements?.map((m) => ({
          productId: m.productId,
          quantityDelta: m.quantityDelta,
          quantityAfter: m.quantityAfter,
        })) ?? undefined,
      items: transaction.items?.map((item) => ({
        ...item,
        quantity: item.quantity,
        product: item.product
          ? { id: item.product.id, name: item.product.name, defaultUnit: item.product.defaultUnit }
          : null,
      })),
      occurredAt: transaction.occurredAt,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}