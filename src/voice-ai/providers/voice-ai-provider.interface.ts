import { ParsedTransaction } from '../voice-ai.types';

export interface ProductContextEntry {
  id: string;
  name: string;
  aliases: string[];
  defaultUnit: string;
  sellingPriceKobo: number | null;
  costPriceKobo: number | null;
}

export interface VoiceAiInput {
  audio: Buffer;
  mimeType: string;
  audioUrl?: string;
  language?: string;
  productContext: ProductContextEntry[];
}

/**
 * Providers are hidden behind this interface (PRD §13.1) so the Gemini
 * implementation can be swapped for OpenAI or a Nigerian-language provider later.
 */
export interface VoiceAiProvider {
  readonly name: string;
  parseTransaction(input: VoiceAiInput): Promise<ParsedTransaction>;
}