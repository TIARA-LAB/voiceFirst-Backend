import { Module } from '@nestjs/common';
import { VoiceAiService } from './voice-ai.service';
import { ProductMatchingService } from './product-matching.service';

@Module({
  providers: [VoiceAiService, ProductMatchingService],
  exports: [VoiceAiService, ProductMatchingService],
})
export class VoiceAiModule {}