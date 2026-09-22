import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_AUDIO_PROCESSING } from '../config/app-config';
import { AudioService } from './audio.service';
import { AudioProcessingService } from './audio-processing.service';
import { AudioController } from './audio.controller';
import { VoiceAiModule } from '../voice-ai/voice-ai.module';
import { ProductsModule } from '../products/products.module';
import { ConfirmationsModule } from '../confirmations/confirmations.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_AUDIO_PROCESSING }),
    VoiceAiModule,
    ProductsModule,
    ConfirmationsModule,
  ],
  controllers: [AudioController],
  providers: [AudioService, AudioProcessingService],
  exports: [AudioService, AudioProcessingService],
})
export class AudioModule {}