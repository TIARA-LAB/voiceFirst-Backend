import { Injectable, NotFoundException } from '@nestjs/common';
import { AudioRecord } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SupabaseStorageProvider } from '../storage/supabase-storage.provider';

export interface UploadedAudio {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class AudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async upload(
    businessId: string,
    userId: string,
    file: UploadedAudio,
    idempotencyKey?: string | null,
  ): Promise<AudioRecord> {
    if (idempotencyKey) {
      const existing = await this.prisma.audioRecord.findUnique({
        where: { idempotencyKey },
        include: { pendingConfirmations: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      if (existing) return existing;
    }

    const key = SupabaseStorageProvider.newObjectKey(file.originalname);
    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.audioRecord.create({
        data: {
          businessId,
          userId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey: key,
          status: 'RECEIVED',
          idempotencyKey: idempotencyKey ?? null,
        },
      });

      const stored = await this.storage.upload(file.buffer, key, file.mimetype);
      return tx.audioRecord.update({
        where: { id: created.id },
        data: {
          status: 'STORED',
          storageBucket: stored.bucket,
          storageProvider: stored.bucket ? 'supabase' : 'local',
        },
      });
    });

    return record;
  }

  async get(businessId: string, audioId: string) {
    const record = await this.prisma.audioRecord.findFirst({
      where: { id: audioId, businessId },
      include: {
        pendingConfirmations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, intent: true },
        },
      },
    });
    if (!record) {
      throw new NotFoundException('Audio record not found');
    }
    return this.toDto(record);
  }

  /** Marks the record as being processed (returns it atomically-ish). */
  async getForProcessing(audioId: string): Promise<AudioRecord> {
    const record = await this.prisma.audioRecord.findUnique({ where: { id: audioId } });
    if (!record) {
      throw new NotFoundException('Audio record not found');
    }
    return this.prisma.audioRecord.update({
      where: { id: record.id },
      data: {
        status: 'PROCESSING',
        retryCount: { increment: 1 },
        errorMessage: null,
      },
    });
  }

  async markProcessed(audioId: string, meta: { draftId: string }): Promise<void> {
    await this.prisma.audioRecord.update({
      where: { id: audioId },
      data: { status: 'PROCESSED', processedAt: new Date(), errorMessage: null },
    });
    void meta;
  }

  async markFailed(audioId: string, message: string): Promise<void> {
    await this.prisma.audioRecord.update({
      where: { id: audioId },
      data: { status: 'FAILED', errorMessage: message.slice(0, 1000) },
    });
  }

  async retry(businessId: string, audioId: string): Promise<{ id: string; status: string }> {
    const record = await this.prisma.audioRecord.findFirst({
      where: { id: audioId, businessId },
    });
    if (!record) {
      throw new NotFoundException('Audio record not found');
    }
    if (record.status !== 'FAILED' && record.status !== 'STORED') {
      return { id: record.id, status: record.status };
    }
    const updated = await this.prisma.audioRecord.update({
      where: { id: record.id },
      data: { status: 'STORED', errorMessage: null },
    });
    return { id: updated.id, status: updated.status };
  }

  async listByBusiness(businessId: string) {
    return this.prisma.audioRecord.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Retention job: deletes audio older than `retentionDays` that produced no confirmed
   * draft (keeps the nursery of confirmations clean; PRD §8.7).
   */
  async deleteExpired(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    const oldRecords = await this.prisma.audioRecord.findMany({
      where: {
        createdAt: { lt: cutoff },
        pendingConfirmations: { none: { status: 'CONFIRMED' } },
      },
      select: { id: true, storageKey: true },
      take: 500,
    });
    if (oldRecords.length === 0) return 0;

    await Promise.allSettled(
      oldRecords.map((r) => this.storage.delete(r.storageKey).catch(() => undefined)),
    );

    const deleted = await this.prisma.audioRecord.deleteMany({
      where: { id: { in: oldRecords.map((r) => r.id) } },
    });
    return deleted.count;
  }

  private toDto(record: AudioRecord & { pendingConfirmations?: Array<{ id: string; status: string; intent: string }> }) {
    return {
      id: record.id,
      fileName: record.fileName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      durationMs: record.durationMs,
      status: record.status,
      errorMessage: record.errorMessage,
      retryCount: record.retryCount,
      processedAt: record.processedAt,
      createdAt: record.createdAt,
      draft:
        record.pendingConfirmations && record.pendingConfirmations.length > 0
          ? record.pendingConfirmations[0]
          : null,
    };
  }
}