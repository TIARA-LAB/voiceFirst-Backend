import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateProductInput, ListProductsInput, PatchProductInput } from './products.schemas';
import { StockMovementKind } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  async create(
    businessId: string,
    userId: string,
    input: CreateProductInput,
  ): Promise<Product> {
    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          businessId,
          name: input.name,
          description: input.description ?? null,
          defaultUnit: input.defaultUnit,
          sellingPriceKobo: input.sellingPriceKobo ?? null,
          costPriceKobo: input.costPriceKobo ?? null,
          openingStock: new Prisma.Decimal(input.openingStock ?? 0),
          currentStock: new Prisma.Decimal(0),
          lowStockThreshold:
            input.lowStockThreshold !== undefined && input.lowStockThreshold !== null
              ? new Prisma.Decimal(input.lowStockThreshold)
              : null,
          aliases:
            input.aliases.length > 0
              ? { create: input.aliases.map((alias) => ({ alias })) }
              : undefined,
        },
      });

      if (input.openingStock && input.openingStock > 0) {
        await this.inventory.applyDelta(tx, {
          businessId,
          productId: created.id,
          delta: input.openingStock,
          kind: StockMovementKind.STOCK_IN,
          note: 'Opening stock',
        });
      }

      await this.audit.record(tx, {
        businessId,
        userId,
        action: 'product.created',
        entityType: 'product',
        entityId: created.id,
      });

      return created;
    });

    return product;
  }

  async list(businessId: string, input: ListProductsInput) {
    const where: Prisma.ProductWhereInput = {
      businessId,
      status: input.includeArchived ? undefined : 'ACTIVE',
    };
    if (input.q) {
      where.OR = [
        { name: { contains: input.q, mode: 'insensitive' } },
        { aliases: { some: { alias: { contains: input.q, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: { aliases: { select: { alias: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);

    const mapped = items.map((product) => ({
      ...product,
      lowStock:
        product.lowStockThreshold !== null &&
        new Prisma.Decimal(product.currentStock).lte(new Prisma.Decimal(product.lowStockThreshold)),
    })).filter((p) => (input.lowStock ? p.lowStock : true));

    return {
      items: mapped,
      total: input.lowStock ? mapped.length : total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async getById(businessId: string, productId: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, businessId },
      include: { aliases: { select: { alias: true } } },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(
    businessId: string,
    userId: string,
    productId: string,
    input: PatchProductInput,
  ): Promise<Product> {
    await this.getById(businessId, productId);

    const data: Prisma.ProductUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.defaultUnit !== undefined) data.defaultUnit = input.defaultUnit;
    if (input.sellingPriceKobo !== undefined) data.sellingPriceKobo = input.sellingPriceKobo;
    if (input.costPriceKobo !== undefined) data.costPriceKobo = input.costPriceKobo;
    if (input.lowStockThreshold !== undefined) {
      data.lowStockThreshold =
        input.lowStockThreshold === null ? null : new Prisma.Decimal(input.lowStockThreshold);
    }

    await this.prisma.$transaction(async (tx) => {
      if (input.aliases) {
        await tx.productAlias.deleteMany({ where: { productId } });
        if (input.aliases.length > 0) {
          await tx.productAlias.createMany({
            data: input.aliases.map((alias) => ({ productId, alias })),
          });
        }
      }
      const updated = await tx.product.update({ where: { id: productId }, data });
      await this.audit.record(tx, {
        businessId,
        userId,
        action: 'product.updated',
        entityType: 'product',
        entityId: productId,
      });
      return updated;
    });

    return this.getById(businessId, productId);
  }

  async archive(businessId: string, userId: string, productId: string): Promise<Product> {
    await this.getById(businessId, productId);
    const product = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { status: 'ARCHIVED' },
      });
      await this.audit.record(tx, {
        businessId,
        userId,
        action: 'product.archived',
        entityType: 'product',
        entityId: productId,
      });
      return updated;
    });
    return product;
  }

  /** Product context fed to the voice AI provider so it can match spoken products. */
  async getContext(businessId: string) {
    const products = await this.prisma.product.findMany({
      where: { businessId, status: 'ACTIVE' },
      include: { aliases: { select: { alias: true } } },
    });
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      aliases: p.aliases.map((a) => a.alias),
      defaultUnit: p.defaultUnit,
      sellingPriceKobo: p.sellingPriceKobo ?? null,
      costPriceKobo: p.costPriceKobo ?? null,
    }));
  }
}