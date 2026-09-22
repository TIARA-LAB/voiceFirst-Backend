import { Injectable } from '@nestjs/common';
import { ProductContextEntry } from './providers/voice-ai-provider.interface';

export type MatchDecision =
  | { decision: 'exact' | 'alias' | 'fuzzy'; productId: string; productName: string }
  | { decision: 'ambiguous'; candidates: Array<{ productId: string; productName: string }> }
  | { decision: 'none' };

export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s{2,}/g, ' ');
}

/**
 * Product matching rules (PRD §13.3):
 *  - exact (or alias) match -> single product
 *  - multiple candidates     -> ambiguous, never silently chosen
 *  - fuzzy containment match -> accepted with a flag
 *  - nothing                 -> none
 */
export function resolveProduct(
  spokenName: string | null | undefined,
  products: ProductContextEntry[],
): MatchDecision {
  const spoken = normalizeName(spokenName ?? '');
  if (!spoken) {
    return { decision: 'none' };
  }

  const exact = products.filter((p) => normalizeName(p.name) === spoken);
  if (exact.length === 1) {
    return { decision: 'exact', productId: exact[0].id, productName: exact[0].name };
  }
  if (exact.length > 1) {
    return {
      decision: 'ambiguous',
      candidates: exact.map((p) => ({ productId: p.id, productName: p.name })),
    };
  }

  const aliases = products.filter((p) => p.aliases.some((a) => normalizeName(a) === spoken));
  if (aliases.length === 1) {
    return { decision: 'alias', productId: aliases[0].id, productName: aliases[0].name };
  }
  if (aliases.length > 1) {
    return {
      decision: 'ambiguous',
      candidates: aliases.map((p) => ({ productId: p.id, productName: p.name })),
    };
  }

  const fuzzy = products.filter((p) => {
    const name = normalizeName(p.name);
    const aliasNames = p.aliases.map(normalizeName);
    return (
      (name.includes(spoken) || spoken.includes(name)) &&
      (aliasNames.some((a) => a.includes(spoken)) ||
        aliasNames.length === 0 ||
        name !== '')
    );
  });
  if (fuzzy.length === 1) {
    return { decision: 'fuzzy', productId: fuzzy[0].id, productName: fuzzy[0].name };
  }
  if (fuzzy.length > 1) {
    return {
      decision: 'ambiguous',
      candidates: fuzzy.map((p) => ({ productId: p.id, productName: p.name })),
    };
  }
  return { decision: 'none' };
}

@Injectable()
export class ProductMatchingService {
  resolve = resolveProduct;
}