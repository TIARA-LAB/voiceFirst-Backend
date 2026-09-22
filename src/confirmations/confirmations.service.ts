import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfirmationStatus, PendingConfirmation, TransactionSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/services/audit.service';
import { AppConfig } from '../config/app-config';
import { TransactionsService } from '../transactions/transactions.service';
import { ProductsService } from '../products/products.service';
import { ProductMatchingService } from '../voice-ai/product-matching.service';
import { ParsedTransaction } from '../voice-ai/voice-ai.types';
import { ProductContextEntry } from '../voice-ai/providers/voice-ai-provider.interface';
import { enumMap } from '../common/enums';
import { normalizeUnitOrRaw } from '../money/units';
import { assessDraft, DraftItem, DraftPayload } from './draft-assessment';
import { PatchDraftInput } from './confirmations.schemas';
import { ConfirmationBlockedError } from '../common/errors/domain-errors';
import { minutesFromNow } from '../common/utils/date-time';

export interface CreateDraftParams {
  businessId: string;
  userId: string;
  audioRecordId?: string | null;
  parsed: ParsedTransaction;
  source: TransactionSource;
}

@Injectable()
export class ConfirmationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
    private readonly productsService: ProductsService,
    private readonly matcher: ProductMatchingService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  async createDraftFromParse(params: CreateDraftParams): Promise<unknown> {
    const { businessId, userId, audioRecordId, parsed, source } = params;
    const products = await this.productsService.getContext(businessId);

    const payload = this.buildPayload(parsed, products, undefined);
    const debtors = await this.prisma.debtor.findMany({
      where: { businessId },
      select: { id: true, name: true },
    });
    if (
      (parsed.intent === 'debt' || parsed.intent === 'payment' || parsed.intent === 'sale') &&
      parsed.counterparty
    ) {
      const match = debtors.find(
        (d) => d.name.toLowerCase() === parsed.counterparty!.toLowerCase(),
      );
      if (match) payload.debtorId = match.id;
      else payload.debtorName = parsed.counterparty;
    }

    const draft = await this.prisma.pendingConfirmation.create({
      data: {
        businessId,
        userId,
        audioRecordId: audioRecordId ?? null,
        intent: enumMap.intentToDb(payload.intent),
        source,
        payload: payload as unknown as object,
        status: 'PENDING',
        expiresAt: minutesFromNow(this.config.confirmationTtlMinutes),
      },
    });

    return this.toDto(draft);
  }

  async get(businessId: string, draftId: string): Promise<unknown> {
    const draft = await this.loadDraft(businessId, draftId);
    return this.toDto(draft);
  }

  async edit(businessId: string, userId: string, draftId: string, edits: PatchDraftInput): Promise<unknown> {
    const draft = await this.requireEditableDraft(businessId, draftId);
    const current = draft.payload as unknown as DraftPayload;
    const products = await this.productsService.getContext(businessId);
    const productMap = new Map(products.map((p) => [p.id, p]));

    const items: DraftItem[] = edits.items
      ? edits.items.map((item) => {
          if (item.productId) {
            const product = productMap.get(item.productId);
            return {
              name: item.name ?? product?.name ?? null,
              quantity: item.quantity ?? null,
              unit: normalizeUnitOrRaw(item.unit) ?? product?.defaultUnit ?? null,
              unitPriceKobo: item.unitPriceKobo ?? null,
              lineTotalKobo: item.lineTotalKobo ?? null,
              matchedProductId: item.productId,
              confidence: 1,
              match: 'user' as const,
            };
          }
          const decision = this.matcher.resolve(item.name, products);
          return {
            name: item.name ?? null,
            quantity: item.quantity ?? null,
            unit:
              normalizeUnitOrRaw(item.unit) ??
              (decision.decision === 'ambiguous' || decision.decision === 'none'
                ? null
                : productMap.get(decision.productId)?.defaultUnit ?? null),
            unitPriceKobo: item.unitPriceKobo ?? null,
            lineTotalKobo: item.lineTotalKobo ?? null,
            matchedProductId:
              decision.decision === 'exact' || decision.decision === 'alias' || decision.decision === 'fuzzy'
                ? decision.productId
                : null,
            confidence: 1,
            match: decision.decision,
          };
        })
      : current.items;

    const nextPayload: DraftPayload = {
      ...current,
      intent: edits.intent ?? current.intent,
      items,
      totalKobo: edits.totalKobo !== undefined ? edits.totalKobo : current.totalKobo,
      paymentMethod: edits.paymentMethod !== undefined ? edits.paymentMethod : current.paymentMethod,
      counterparty: edits.counterparty !== undefined ? edits.counterparty : current.counterparty,
      debtorId: edits.debtorId !== undefined ? edits.debtorId : current.debtorId,
    };

    const assessment = assessDraft(nextPayload, products);
    nextPayload.ambiguities.push(...assessment.ambiguities);
    nextPayload.missingFields = assessment.missingFields;
    nextPayload.blocking = assessment.blocking;
    nextPayload.warnings = assessment.warnings;

    const updated = await this.prisma.pendingConfirmation.update({
      where: { id: draft.id },
      data: {
        intent: enumMap.intentToDb(nextPayload.intent),
        payload: nextPayload as unknown as object,
      },
    });

    await this.audit.record(this.prisma, {
      businessId,
      userId,
      action: 'confirmation.edited',
      entityType: 'pending_confirmation',
      entityId: draft.id,
    });

    return this.toDto(updated);
  }

  async cancel(businessId: string, userId: string, draftId: string): Promise<{ status: ConfirmationStatus }> {
    const draft = await this.requireEditableDraft(businessId, draftId);
    const updated = await this.prisma.pendingConfirmation.update({
      where: { id: draft.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await this.audit.record(this.prisma, {
      businessId,
      userId,
      action: 'confirmation.cancelled',
      entityType: 'pending_confirmation',
      entityId: draft.id,
    });
    return { status: updated.status };
  }

  /** PRD §19: atomic persistence of a confirmed draft. */
  async confirm(
    businessId: string,
    userId: string,
    draftId: string,
    idempotencyKey?: string,
  ): Promise<unknown> {
    const draft = await this.requireEditableDraft(businessId, draftId);
    const products = await this.productsService.getContext(businessId);
    const payload = draft.payload as unknown as DraftPayload;

    const assessment = assessDraft(payload, products);
    if (assessment.blocking.length > 0) {
      throw new ConfirmationBlockedError(assessment.blocking);
    }

    const transaction = await this.transactionsService.commit({
      businessId,
      userId,
      type: enumMap.intentToDb(payload.intent),
      source: draft.source,
      items: payload.items.map((item) => ({
        productId: item.matchedProductId,
        quantity: item.quantity ?? 0,
        unit: item.unit ?? 'unit',
        name: item.name ?? undefined,
        unitPriceKobo: item.unitPriceKobo,
        lineTotalKobo: item.lineTotalKobo,
      })),
      totalKobo: payload.totalKobo,
      paymentMethod: enumMap.paymentToDb(payload.paymentMethod ?? null),
      counterparty: payload.counterparty,
      debtorId: payload.debtorId,
      debtorName: payload.debtorName,
      note: `Voiced transaction (${draft.id})`,
      idempotencyKey: idempotencyKey ?? `draft:${draft.id}`,
    });

    await this.prisma.pendingConfirmation.update({
      where: { id: draft.id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedTransactionId: transaction.id },
    });

    await this.audit.record(this.prisma, {
      businessId,
      userId,
      transactionId: transaction.id,
      action: 'confirmation.confirmed',
      entityType: 'pending_confirmation',
      entityId: draft.id,
    });

    return {
      draftId: draft.id,
      status: 'CONFIRMED',
      warnings: assessment.warnings,
      transaction: this.transactionsService.toDto(transaction),
    };
  }

  /** Cleanup job: marks all overdue PENDING drafts as EXPIRED. */
  async expireOverdueDrafts(): Promise<number> {
    const res = await this.prisma.pendingConfirmation.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
    return res.count;
  }

  /** Builds a DraftPayload from a parsed AI transaction, normalizing units/prices/payments. */
  private buildPayload(
    parsed: ParsedTransaction,
    products: ProductContextEntry[],
    _matchedBy: DraftItem['match'] | undefined,
  ): DraftPayload {
    const items: DraftItem[] = parsed.items.map((item) => {
      const decision = this.matcher.resolve(item.name, products);
      const product =
        decision.decision === 'exact' || decision.decision === 'alias' || decision.decision === 'fuzzy'
          ? products.find((p) => p.id === decision.productId)
          : undefined;
      return {
        name: item.name ?? product?.name ?? null,
        quantity: item.quantity ?? null,
        unit: normalizeUnitOrRaw(item.unit) ?? product?.defaultUnit ?? null,
        unitPriceKobo:
          item.unitPriceKobo ?? (parsed.intent === 'sale' ? product?.sellingPriceKobo ?? null : null),
        lineTotalKobo: item.lineTotalKobo ?? null,
        matchedProductId:
          item.matchedProductId ??
          (decision.decision === 'exact' || decision.decision === 'alias' || decision.decision === 'fuzzy'
            ? decision.productId
            : null),
        confidence: item.confidence ?? 0,
        match: decision.decision,
      };
    });

    const totalKobo =
      parsed.totalKobo ??
      (items.reduce(
        (sum, item) =>
          sum +
          (item.lineTotalKobo ?? (item.unitPriceKobo !== null && item.quantity ? Math.round(item.quantity * item.unitPriceKobo) : 0)),
        0,
      ) || null);

    const payload: DraftPayload = {
      intent: parsed.intent,
      items,
      totalKobo,
      paymentMethod: parsed.paymentMethod,
      counterparty: parsed.counterparty,
      debtorId: null,
      debtorName: null,
      confidence: parsed.confidence,
      missingFields: [...parsed.missingFields],
      ambiguities: [...parsed.ambiguities],
      warnings: [],
      blocking: [],
    };

    const assessment = assessDraft(payload, products);
    payload.warnings = assessment.warnings;
    payload.blocking = assessment.blocking;
    payload.missingFields = assessment.missingFields;
    payload.ambiguities = assessment.ambiguities;
    return payload;
  }

  private async loadDraft(businessId: string, draftId: string): Promise<PendingConfirmation> {
    const draft = await this.prisma.pendingConfirmation.findFirst({
      where: { id: draftId, businessId },
    });
    if (!draft) {
      throw new NotFoundException('Confirmation not found');
    }
    return draft;
  }

  private async requireEditableDraft(businessId: string, draftId: string): Promise<PendingConfirmation> {
    const draft = await this.loadDraft(businessId, draftId);
    if (draft.status !== 'PENDING') {
      throw new ConflictException(`Confirmation has already been ${draft.status.toLowerCase()}`);
    }
    if (draft.expiresAt.getTime() < Date.now()) {
      await this.prisma.pendingConfirmation.update({
        where: { id: draft.id },
        data: { status: 'EXPIRED' },
      });
      throw new ConflictException('Confirmation has expired; record the transaction again');
    }
    return draft;
  }

  private toDto(draft: PendingConfirmation): unknown {
    const payload = draft.payload as unknown as DraftPayload;
    return {
      id: draft.id,
      intent: enumMap.intentFromDb(draft.intent),
      source: draft.source,
      status: draft.status,
      expiresAt: draft.expiresAt,
      confirmedAt: draft.confirmedAt,
      cancelledAt: draft.cancelledAt,
      confirmedTransactionId: draft.confirmedTransactionId,
      audioRecordId: draft.audioRecordId,
      payload,
    };
  }
}