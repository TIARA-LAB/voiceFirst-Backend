import { resolveProduct } from './product-matching.service';
import { ProductContextEntry } from './providers/voice-ai-provider.interface';

const products: ProductContextEntry[] = [
  {
    id: 'p1',
    name: 'Rice 50kg',
    aliases: ['rice', 'basmati'],
    defaultUnit: 'bag',
    sellingPriceKobo: 1_500_000,
    costPriceKobo: 1_200_000,
  },
  {
    id: 'p2',
    name: 'Sugar',
    aliases: ['sugar', 'suga'],
    defaultUnit: 'bag',
    sellingPriceKobo: 700_000,
    costPriceKobo: 600_000,
  },
  {
    id: 'p3',
    name: 'Peak Milk',
    aliases: ['peak', 'evap'],
    defaultUnit: 'carton',
    sellingPriceKobo: 250_000,
    costPriceKobo: 200_000,
  },
];

describe('resolveProduct', () => {
  it('matches exact product name', () => {
    const d = resolveProduct('sugar', products);
    expect(d.decision).toBe('exact');
    if (d.decision === 'exact') expect(d.productId).toBe('p2');
  });

  it('matches an alias', () => {
    const d = resolveProduct('rice', products);
    expect(d.decision).toBe('alias' as const);
    if (d.decision === 'alias') expect(d.productId).toBe('p1');
  });

  it('falls back to fuzzy containment', () => {
    const d = resolveProduct('sugar 50kg', products);
    if (d.decision === 'exact' || d.decision === 'alias' || d.decision === 'fuzzy') {
      expect(d.productId).toBe('p2');
    } else {
      fail('expected a match');
    }
  });

  it('never silently picks among ambiguous candidates', () => {
    const d = resolveProduct('peak', [products[2], { ...products[2], id: 'dup' }]);
    expect(d.decision).toBe('ambiguous' as const);
    if (d.decision === 'ambiguous') expect(d.candidates.length).toBe(2);
  });

  it('returns none for unknown products', () => {
    const d = resolveProduct('kuli kuli', products);
    expect(d.decision).toBe('none' as const);
  });

  it('handles empty/null names', () => {
    expect(resolveProduct('', products).decision).toBe('none' as const);
    expect(resolveProduct(null, products).decision).toBe('none' as const);
  });

  it('is case-insensitive and ignores punctuation', () => {
    const d = resolveProduct('SUGAR!!', products);
    expect(d.decision).toBe('exact' as const);
  });
});