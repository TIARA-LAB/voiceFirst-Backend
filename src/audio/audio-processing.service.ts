import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { TransactionSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_AUDIO_PROCESSING } from '../config/app-config';
import { StorageService } from '../storage/storage.service';
import { ProductsService } from '../products/products.service';
import { VoiceAiService } from '../voice-ai/voice-ai.service';
import { ConfirmationsService } from '../confirmations/confirmations.service';
import { AudioService } from './audio.service';

@Injectable()
export class AudioProcessingService {
  private readonly logger = new Logger(AudioProcessingService.name);

  constructor(
    private readonly audioService: AudioService,
    private readonly storage: StorageService,
    private readonly products: ProductsService,
    private readonly voiceAi: VoiceAiService,
    private readonly confirmations: ConfirmationsService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_AUDIO_PROCESSING) private readonly queue: Queue,
  ) {}

  /** Enqueue the job; if Redis is down, process inline so development flows still work. */
  async enqueueOrProcess(audioId: string): Promise<void> {
    try {
      await this.queue.add(
        'process',
        { audioId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { age: 86_400 },
          removeOnFail: { age: 604_800 },
        },
      );
    } catch {
      this.logger.warn('Queue unavailable; processing audio inline');
      await this.process(audioId);
    }
  }

  /** Full pipeline: fetch bytes → voice AI → draft → status bookkeeping. */
  async process(audioId: string): Promise<{ draftId: string }> {
    const record = await this.audioService.getForProcessing(audioId);
    const business = await this.prisma.business.findUnique({
      where: { id: record.businessId },
    });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    try {
      const bytes = await this.storage.getBytes(record.storageKey);
      const productContext = await this.products.getContext(record.businessId);

      const parsed = await this.voiceAi.parseFromBytes({
        audio: bytes,
        mimeType: record.mimeType,
        language: business.preferredLanguage ?? 'en',
        productContext,
      });

      const draft = (await this.confirmations.createDraftFromParse({
        businessId: record.businessId,
        userId: record.userId,
        audioRecordId: record.id,
        parsed,
        source: TransactionSource.VOICE,
      })) as { id: string };

      await this.audioService.markProcessed(record.id, { draftId: draft.id });
      this.logger.log(`Audio ${record.id} processed → draft ${draft.id}`);
      return { draftId: draft.id };
    } catch (err) {
      await this.audioService.markFailed(
        record.id,
        err instanceof Error ? err.message : 'Unknown processing error',
      );
      this.logger.error(`Audio ${record.id} failed: ${(err as Error).message}`);
      throw err;
    }
  }
}