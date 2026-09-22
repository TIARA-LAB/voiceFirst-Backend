import { GoogleGenerativeAI } from '@google/generative-ai';
import { ParsedTransaction, ParsedTransactionSchema } from '../voice-ai.types';
import { VoiceAiProvider, VoiceAiInput } from './voice-ai-provider.interface';
import { VoiceAiError } from '../../common/errors/domain-errors';

const PROMPT = `
You transcribe and understand a Nigerian trader's spoken business transaction and return
structured JSON only. Follow these rules strictly:

1. Detect the transaction intent from: sale, purchase, expense, stock_in, debt, payment.
2. For each product mentioned, give: name, quantity, unit, unit_price_kobo (integer kobo,
   where 100 kobo = 1 naira), line_total_kobo.
3. Understand Nigerian money expressions: "45k" or "forty-five k" means 45,000 naira;
   "3k" means 3,000 naira. Convert naira to kobo by multiplying by 100.
4. Understand local units: bag, half bag, carton, crate, bottle, pack, mudu, paint rubber,
   piece, wrap, gallon, sachet, dozen, cup, bowl.
5. Return null for any value you did not hear. NEVER guess a price or quantity.
6. If the product is in the provided product_context, set matchedProductId to its id.
   When several context products could match, do not pick one — report it in ambiguities.
7. Payment method is one of: cash, transfer, pos, credit, partial, unknown.
8. Output ONLY valid JSON matching this schema:
{
  "intent": "sale",
  "items": [{
    "name": "rice", "quantity": 3, "unit": "bag",
    "unitPriceKobo": 1500000, "lineTotalKobo": 4500000,
    "matchedProductId": "id-or-null", "confidence": 0.9
  }],
  "totalKobo": 4500000,
  "paymentMethod": "cash",
  "counterparty": "name-or-null",
  "confidence": 0.85,
  "missingFields": ["payment_method"],
  "ambiguities": []
}`;

export class GeminiVoiceAiProvider implements VoiceAiProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {
    if (!apiKey) {
      throw new VoiceAiError('GEMINI_API_KEY is required when VOICE_AI_PROVIDER=gemini');
    }
  }

  async parseTransaction(input: VoiceAiInput): Promise<ParsedTransaction> {
    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ model: this.model });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: input.mimeType,
            data: input.audio.toString('base64'),
          },
        },
        {
          text: `${PROMPT}\n\nproduct_context:\n${JSON.stringify(input.productContext)}`,
        },
      ]);

      const text = result.response.text();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) {
        throw new VoiceAiError('Gemini response did not contain JSON');
      }
      const raw = JSON.parse(text.slice(start, end + 1));

      const parsed = ParsedTransactionSchema.safeParse(raw);
      if (!parsed.success) {
        throw new VoiceAiError('Gemini returned an invalid schema', {
          errors: parsed.error.issues.slice(0, 10),
        });
      }
      return parsed.data;
    } catch (err) {
      if (err instanceof VoiceAiError) throw err;
      throw new VoiceAiError(
        `Gemini audio understanding failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}