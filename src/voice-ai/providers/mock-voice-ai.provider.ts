import { ParsedTransaction } from '../voice-ai.types';
import { VoiceAiProvider, VoiceAiInput } from './voice-ai-provider.interface';

/**
 * Deterministic offline provider used for development and staging.
 * It does not "listen" to audio; it emits a canonical, realistic parse that exercises
 * the full pipeline (defensive: unit tests + e2e work without external keys).
 */
export class MockVoiceAiProvider implements VoiceAiProvider {
  readonly name = 'mock';

  async parseTransaction(_input: VoiceAiInput): Promise<ParsedTransaction> {
    return {
      intent: 'sale',
      items: [
        {
          name: 'rice',
          quantity: 3,
          unit: 'bag',
          unitPriceKobo: 1_500_000, // ₦15,000
          lineTotalKobo: 4_500_000, // ₦45,000
          confidence: 0.92,
        },
      ],
      totalKobo: 4_500_000,
      paymentMethod: null,
      counterparty: null,
      confidence: 0.87,
      missingFields: ['payment_method', 'counterparty'],
      ambiguities: [],
    };
  }
}