import { Injectable, NotFoundException } from '@nestjs/common';
import { Debtor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.module';
import { DEFAULT_PAGE_SIZE } from '../common/constants';
import { CreateDebtorBody, UpdateDebtorBody } from './debtors.schemas';

export interface DebtorListQuery {
  page: number;
  limit: number;
  q?: string;
  status?: 'ACTIVE' | 'SETTLED';
}

@Injectable()
export class DebtorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(businessId: string, query: DebtorListQuery) {
    const page = Math.max(query.page, 1);
    const limit = Math.min(Math.max(query.limit || DEFAULT_PAGE_SIZE, 1), 100);
    const where = this.buildWhere(businessId, query);

    const [total, items] = await Promise.all([
      this.prisma.debtor.count({ where }),
      this.prisma.debtor.findMany({
        where,
        orderBy: [{ status: 'asc' }, { outstandingBalanceKobo: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async get(businessId: string, id: string): Promise<Debtor> {
    const debtor = await this.prisma.debtor.findFirst({ where: { id, businessId } });
    if (!debtor) throw new NotFoundException('Debtor not found');
    return debtor;
  }

  async create(businessId: string, body: CreateDebtorBody) {
    const existing = await this.prisma.debtor.findFirst({
      where: { businessId, name: { equals: body.name, mode: 'insensitive' } },
    });
    if (existing) {
      return this.update(businessId, existing.id, { phone: body.phone, status: 'ACTIVE' });
    }
    return this.prisma.debtor.create({
      data: {
        businessId,
        name: body.name,
        phone: body.phone ?? null,
        outstandingBalanceKobo: 0,
      },
    });
  }

  async update(businessId: string, id: string, body: UpdateDebtorBody) {
    const debtor = await this.get(businessId, id);
    return this.prisma.debtor.update({
      where: { id: debtor.id },
      data: {
        name: body.name ?? undefined,
        phone: body.phone !== undefined ? body.phone || null : undefined,
        status: body.status ?? undefined,
      },
    });
  }

  async stats(businessId: string) {
    const [active, totalOutstanding] = await Promise.all([
      this.prisma.debtor.count({ where: { businessId } }),
      this.prisma.debtor.aggregate({
        where: { businessId },
        _sum: { outstandingBalanceKobo: true },
      }),
    ]);
    return {
      totalDebtors: active,
      outstandingKobo: totalOutstanding._sum.outstandingBalanceKobo ?? 0,
    };
  }

  /** MVP reminder: sends a polite WhatsApp message via the Notifications channel. */
  async remind(businessId: string, id: string) {
    const debtor = await this.get(businessId, id);
    if (debtor.outstandingBalanceKobo > 0 && debtor.phone) {
      await this.notifications.sendMessage(
        debtor.phone,
        `Hello ${debtor.name}, please kindly settle your outstanding balance of ₦${
          debtor.outstandingBalanceKobo / 100
        } with us. Thank you!`,
      );
    }
    return {
      reminded: true,
      via: debtor.phone ? 'sms' : null,
      message:
        debtor.phone && debtor.outstandingBalanceKobo > 0
          ? 'Reminder sent.'
          : 'No phone on file or zero balance; add a phone to enable reminders.',
    };
  }

  private buildWhere(businessId: string, query: DebtorListQuery) {
    const where: Record<string, unknown> = { businessId };
    if (query.status) where.status = query.status as string;
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q } },
      ];
    }
    return where;
  }
}