import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { QUEUE_AUDIO_PROCESSING, QUEUE_CLEANUP, QUEUE_REPORTS, QUEUE_WHATSAPP } from '../config/app-config';
import { AppConfig } from '../config/app-config';
import { PrismaService } from '../prisma/prisma.service';
import { AudioProcessingService } from '../audio/audio-processing.service';
import { AudioService } from '../audio/audio.service';
import { ConfirmationsService } from '../confirmations/confirmations.service';
import { ReportsService } from '../reports/reports.service';

@Processor(QUEUE_AUDIO_PROCESSING, { concurrency: 2 })
@Injectable()
export class AudioProcessingWorker extends WorkerHost {
  constructor(private readonly audioProcessing: AudioProcessingService) {
    super();
  }

  async process(job: Job<{ audioId: string }>): Promise<{ draftId: string }> {
    return this.audioProcessing.process(job.data.audioId);
  }
}

@Processor(QUEUE_CLEANUP)
@Injectable()
export class CleanupWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(CleanupWorker.name);

  constructor(
    private readonly confirmations: ConfirmationsService,
    private readonly audioService: AudioService,
    private readonly config: AppConfig,
    @InjectQueue(QUEUE_CLEANUP) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      'expired-confirmations',
      {},
      { repeat: { every: 10 * 60 * 1000 }, jobId: 'expired-confirmations' },
    );
    await this.queue.add(
      'audio-retention',
      {},
      { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: 'audio-retention' },
    );
  }

  async process(job: Job): Promise<{ expired?: number; deleted?: number }> {
    if (job.name === 'audio-retention') {
      const deleted = await this.audioService.deleteExpired(this.config.audio.retentionDays);
      if (deleted > 0) this.logger.log(`Deleted ${deleted} expired audio records`);
      return { deleted };
    }
    const expired = await this.confirmations.expireOverdueDrafts();
    if (expired > 0) this.logger.log(`Expired ${expired} overdue confirmation drafts`);
    return { expired };
  }
}

@Processor(QUEUE_REPORTS)
@Injectable()
export class DailySummaryWorker extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(DailySummaryWorker.name);

  constructor(
    private readonly reports: ReportsService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_REPORTS) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.add('daily-summary', {}, { repeat: { every: 60 * 60 * 1000 }, jobId: 'daily-summary' });
  }

  async process(): Promise<{ businesses: number }> {
    const businesses = await this.prisma.business.findMany({ select: { id: true } });
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    for (const b of businesses) {
      await this.reports
        .computeDailySummary({ businessId: b.id, date: yesterday })
        .catch((err) => this.logger.warn(`Daily summary failed for ${b.id}: ${err.message}`));
    }
    return { businesses: businesses.length };
  }
}

@Processor(QUEUE_WHATSAPP)
@Injectable()
export class WhatsAppWorker extends WorkerHost {
  private readonly logger = new Logger(WhatsAppWorker.name);

  process(job: Job<{ id: string; target: string; body: string }>): Promise<void> {
    // MVP delivery happens via the Notifications console adapter; a real Graph API
    // adapter replaces this later (PRD §12).
    this.logger.log(`[whatsapp] -> ${job.data.target}: ${job.data.body}`);
    return Promise.resolve();
  }
}