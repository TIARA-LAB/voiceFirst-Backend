import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { VoiceAiProvider, ProductContextEntry } from './providers/voice-ai-provider.interface';
import { MockVoiceAiProvider } from './providers/mock-voice-ai.provider';
import { GeminiVoiceAiProvider } from './providers/gemini-voice-ai.provider';
import { ParsedTransaction, ParsedTransactionSchema } from './voice-ai.types';
import { VoiceAiError } from '../common/errors/domain-errors';

export interface ParseInput {
  audio: Buffer;
  mimeType: string;
  language?: string;
  productContext: ProductContextEntry[];
}

@Injectable()
export class VoiceAiService {
  private readonly logger = new Logger(VoiceAiService.name);

  constructor(private readonly config: AppConfig) {}

  private getProvider(): VoiceAiProvider {
    switch (this.config.voiceAi.provider) {
      case 'gemini':
        return new GeminiVoiceAiProvider(
          this.config.voiceAi.geminiApiKey ?? '',
          this.config.voiceAi.geminiModel,
        );
      case 'mock':
      default:
        return new MockVoiceAiProvider();
    }
  }

  /** Validates AI output against the structured schema (PRD §13.2/§13.3). */
  validateParsed(raw: unknown): ParsedTransaction {
    const result = ParsedTransactionSchema.safeParse(raw);
    if (!result.success) {
      throw new VoiceAiError('Voice AI returned an invalid schema', {
        errors: result.error.issues.slice(0, 10),
      });
    }
    return result.data;
  }

  /** Runs the audio through the configured provider and returns a schema-valid parse. */
  async parseFromBytes(input: ParseInput): Promise<ParsedTransaction> {
    const provider = this.getProvider();
    this.logger.log(`Voice AI parse via provider="${provider.name}"`);
    const raw = await provider.parseTransaction({
      audio: input.audio,
      mimeType: input.mimeType,
      language: input.language,
      productContext: input.productContext,
    });
    return this.validateParsed(raw);
  }
}