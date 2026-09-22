import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockMovementKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InsufficientStockError } from '../common/errors/domain-errors';

type DbClient = PrismaService | Prisma.TransactionClient;

export interface ApplyDeltaParams {
  businessId: string;
  productId: string;
  delta: number | Prisma.Decimal;
  kind: StockMovementKind;
  transactionId?: string | null;
  note?: string | null;
  allowNegative?: boolean;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Applies a quantity delta to a product's stock inside the given client scope and
   * appends a stock movement with the resulting balance (audit trail).
   * Negative stock is rejected unless explicitly allowed.
   */
  async applyDelta(client: DbClient, params: ApplyDeltaParams) {
    const product = await client.product.findFirst({
      where: { id: params.productId, businessId: params.businessId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const delta = new Prisma.Decimal(params.delta);
    const current = new Prisma.Decimal(product.currentStock);
    const after = current.plus(delta);

    if (after.isNegative() && !params.allowNegative) {
      throw new InsufficientStockError(product.name, current.toNumber(), Math.abs(delta.toNumber()));
    }

    await client.stockMovement.create({
      data: {
        businessId: params.businessId,
        productId: params.productId,
        transactionId: params.transactionId ?? null,
        intent: params.kind,
        quantityDelta: delta,
        quantityAfter: after,
        note: params.note ?? null,
      },
    });

    await client.product.update({
      where: { id: params.productId },
      data: { currentStock: after },
    });

    return { quantityAfter: after.toNumber() };
  }

  /** Periodic record of current stock per product. */
  async snapshot(businessId: string) {
    const products = await this.prisma.product.findMany({
      where: { businessId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      defaultUnit: p.defaultUnit,
      currentStock: new Prisma.Decimal(p.currentStock).toNumber(),
      lowStockThreshold: p.lowStockThreshold
        ? new Prisma.Decimal(p.lowStockThreshold).toNumber()
        : null,
      lowStock:
        p.lowStockThreshold !== null &&
        new Prisma.Decimal(p.currentStock).lte(new Prisma.Decimal(p.lowStockThreshold)),
    }));
  }

  async movements(businessId: string, productId: string, page = 1, pageSize = 20) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const where: Prisma.StockMovementWhereInput = { businessId, productId };
    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { transaction: { select: { id: true, type: true, note: true, createdAt: true } } },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async adjust(
    businessId: string,
    userId: string,
    productId: string,
    delta: number,
    note: string | null,
  ): Promise<{ quantityAfter: number }> {
    return this.prisma.$transaction(async (tx) => {
      const result = await this.applyDelta(tx, {
        businessId,
        productId,
        delta,
        kind: StockMovementKind.ADJUSTMENT,
        note: note ?? 'Manual stock adjustment',
      });
      await tx.auditEvent.create({
        data: {
          businessId,
          userId,
          action: 'stock.adjusted',
          entityType: 'product',
          entityId: productId,
          meta: { delta, note },
        },
      });
      return result;
    });
  }
}