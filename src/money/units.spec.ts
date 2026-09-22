import { normalizeUnit, normalizeUnitOrRaw, KNOWN_UNITS } from './units';

describe('normalizeUnit', () => {
  it('collapses plurals to canonical units', () => {
    expect(normalizeUnit('bags')).toBe('bag');
    expect(normalizeUnit('cartons')).toBe('carton');
    expect(normalizeUnit('pcs')).toBe('piece');
  });

  it('normalizes local units', () => {
    expect(normalizeUnit('mudu')).toBe('mudu');
    expect(normalizeUnit('paint rubber')).toBe('paint rubber');
    expect(normalizeUnit('paintrubber')).toBe('paint rubber');
    expect(normalizeUnit('rubber')).toBe('paint rubber');
    expect(normalizeUnit('half-bag')).toBe('half bag');
  });

  it('returns null for unknown units', () => {
    expect(normalizeUnit('kalangu')).toBeNull();
    expect(normalizeUnit(null)).toBeNull();
  });

  it('exposes canonical known units', () => {
    expect(KNOWN_UNITS).toContain('bag');
    expect(KNOWN_UNITS).toContain('mudu');
  });
});

describe('normalizeUnitOrRaw', () => {
  it('falls back to the raw value when unknown', () => {
    expect(normalizeUnitOrRaw('Ghana must go')).toBe('ghana must go');
  });

  it('normalizes known units', () => {
    expect(normalizeUnitOrRaw('Bags')).toBe('bag');
  });
});