import { ProductContextEntry } from '../voice-ai/providers/voice-ai-provider.interface';

export interface DraftItem {
  name: string | null;
  quantity: number | null;
  unit: string | null;
  unitPriceKobo: number | null;
  lineTotalKobo: number | null;
  matchedProductId: string | null;
  confidence: number;
  match: 'none' | 'exact' | 'alias' | 'fuzzy' | 'ambiguous' | 'user';
}

export interface DraftPayload {
  intent: 'sale' | 'purchase' | 'expense' | 'stock_in' | 'debt' | 'payment';
  items: DraftItem[];
  totalKobo: number | null;
  paymentMethod: 'cash' | 'transfer' | 'pos' | 'credit' | 'partial' | 'unknown' | null;
  counterparty: string | null;
  debtorId: string | null;
  debtorName: string | null;
  confidence: number;
  missingFields: string[];
  ambiguities: string[];
  warnings: string[];
  blocking: string[];
}

export interface DraftAssessment {
  blocking: string[];
  warnings: string[];
  missingFields: string[];
  ambiguities: string[];
}

/**
 * Confirm-card assessment (PRD §14.3/§14.4). Blocking issues prevent confirmation;
 * warnings allow it to proceed with caution.
 */
export function assessDraft(payload: DraftPayload, products: ProductContextEntry[]): DraftAssessment {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];
  const ambiguities: string[] = [];

  const isStockIntent = ['sale', 'purchase', 'stock_in'].includes(payload.intent);

  if (isStockIntent && (!payload.items || payload.items.length === 0)) {
    blocking.push('No product identified');
    missingFields.push('items');
  }

  for (const item of payload.items ?? []) {
    if (isStockIntent && !item.name && !item.matchedProductId) {
      missingFields.push('product');
    }
    if (isStockIntent && !item.matchedProductId && item.match !== 'user') {
      blocking.push(`Product "${item.name ?? 'unknown'}" could not be matched to your catalog`);
    }
    if (item.match === 'ambiguous') {
      ambiguities.push(`Multiple products may match "${item.name}"`);
    }
    if (isStockIntent && (item.quantity === null || item.quantity === undefined || item.quantity <= 0)) {
      blocking.push(`Quantity is missing for "${item.name ?? 'unknown'}"`);
      missingFields.push('quantity');
    }
    const line =
      item.lineTotalKobo ??
      (item.unitPriceKobo !== null && item.quantity
        ? Math.round(item.quantity * item.unitPriceKobo)
        : null);
    if (isStockIntent && line === null) {
      blocking.push(`The total cannot be calculated for "${item.name ?? 'unknown'}"`);
      missingFields.push('total');
    }
  }

  const total = payload.totalKobo ?? payload.items.reduce((sum, i) => sum + (i.lineTotalKobo ?? 0), 0);
  if (payload.intent === 'expense' || payload.intent === 'debt' || payload.intent === 'payment') {
    if (!total) {
      blocking.push('The total cannot be calculated');
      missingFields.push('total');
    }
  }

  const isCreditSale =
    payload.intent === 'sale' && (payload.paymentMethod === 'credit' || payload.paymentMethod === 'partial');
  if ((payload.intent === 'debt' || payload.intent === 'payment') && !payload.debtorName && !payload.debtorId) {
    blocking.push('A debtor is required');
    missingFields.push('debtor');
  }
  if (isCreditSale && !payload.debtorName && !payload.debtorId) {
    blocking.push('A credit sale requires a debtor');
    missingFields.push('debtor');
  }

  // Warnings (non-blocking).
  if (payload.intent === 'sale' && !isCreditSale && (!payload.paymentMethod || payload.paymentMethod === 'unknown')) {
    warnings.push('Payment method not specified');
  }
  if (payload.intent === 'sale' && !isCreditSale && !payload.counterparty) {
    warnings.push('Customer not specified');
  }
  if (payload.intent === 'sale') {
    const hasCost = (payload.items ?? []).every((item) => {
      const product = products.find((p) => p.id === item.matchedProductId);
      return product?.costPriceKobo != null;
    });
    if (!hasCost) {
      warnings.push('Cost price unavailable; profit will be estimated');
    }
  }

  return { blocking, warnings, missingFields, ambiguities };
}