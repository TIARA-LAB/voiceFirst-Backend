import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_CLEANUP, QUEUE_REPORTS, QUEUE_WHATSAPP } from '../config/app-config';
import { AudioModule } from '../audio/audio.module';
import { ConfirmationsModule } from '../confirmations/confirmations.module';
import { ReportsModule } from '../reports/reports.module';
import {
  AudioProcessingWorker,
  CleanupWorker,
  DailySummaryWorker,
  WhatsAppWorker,
} from './jobs.processors';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_CLEANUP },
      { name: QUEUE_REPORTS },
      { name: QUEUE_WHATSAPP },
    ),
    AudioModule,
    ConfirmationsModule,
    ReportsModule,
  ],
  providers: [
    AudioProcessingWorker,
    CleanupWorker,
    DailySummaryWorker,
    WhatsAppWorker,
  ],
})
export class JobsModule {}