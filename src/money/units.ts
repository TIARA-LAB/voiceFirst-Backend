/**
 * Local unit normalizer. Nigerian market traders use units such as bag, half bag,
 * carton, crate, paint rubber, mudu, wrap, sachet etc.
 * Keeps the source unit string canonical (the operator's unit) with a wide set of
 * spoken/typo variants collapsed onto it.
 */

const UNIT_ALIASES: Array<[string, string]> = [
  ['bag', 'bag'],
  ['bags', 'bag'],
  ['sack', 'bag'],
  ['halfbag', 'half bag'],
  ['half bag', 'half bag'],
  ['half-bag', 'half bag'],
  ['quarter bag', 'quarter bag'],
  ['carton', 'carton'],
  ['cartons', 'carton'],
  ['crate', 'crate'],
  ['crates', 'crate'],
  ['bottle', 'bottle'],
  ['bottles', 'bottle'],
  ['pack', 'pack'],
  ['packs', 'pack'],
  ['pak', 'pack'],
  ['mudu', 'mudu'],
  ['mudus', 'mudu'],
  ['paint rubber', 'paint rubber'],
  ['paintrubber', 'paint rubber'],
  ['rubber', 'paint rubber'],
  ['rubbers', 'paint rubber'],
  ['paintrubber', 'paint rubber'],
  ['piece', 'piece'],
  ['pieces', 'piece'],
  ['pcs', 'piece'],
  ['pc', 'piece'],
  ['wrap', 'wrap'],
  ['wraps', 'wrap'],
  ['nylon', 'wrap'],
  ['gallon', 'gallon'],
  ['gallons', 'gallon'],
  ['tin', 'tin'],
  ['tins', 'tin'],
  ['sachet', 'sachet'],
  ['sachets', 'sachet'],
  ['dozen', 'dozen'],
  ['dozens', 'dozen'],
  ['box', 'box'],
  ['boxes', 'box'],
  ['pair', 'pair'],
  ['pairs', 'pair'],
  ['cup', 'cup'],
  ['cups', 'cup'],
  ['bowl', 'bowl'],
  ['bowls', 'bowl'],
  ['litre', 'litre'],
  ['litres', 'litre'],
  ['liter', 'liter'],
  ['liters', 'liter'],
  ['kg', 'kg'],
  ['kilo', 'kg'],
  ['kilogram', 'kg'],
  ['unit', 'unit'],
  ['units', 'unit'],
];

const reduce = (value: string): string => value.toLowerCase().replace(/[\s_-]+/g, '');

const LOOKUP: Record<string, string> = {};
for (const [alias, canonical] of UNIT_ALIASES) {
  LOOKUP[reduce(alias)] = canonical;
}

export const KNOWN_UNITS = [
  'bag',
  'half bag',
  'quarter bag',
  'carton',
  'crate',
  'bottle',
  'pack',
  'mudu',
  'paint rubber',
  'piece',
  'wrap',
  'gallon',
  'tin',
  'sachet',
  'dozen',
  'box',
  'pair',
  'cup',
  'bowl',
  'litre',
  'liter',
  'kg',
  'unit',
];

/** Returns the canonical unit for a spoken unit, or null when unknown. */
export function normalizeUnit(rawUnit: string | null | undefined): string | null {
  if (!rawUnit) return null;
  const key = reduce(rawUnit);
  return LOOKUP[key] ?? null;
}

/** Same as normalizeUnit but returns the raw value when unknown. */
export function normalizeUnitOrRaw(rawUnit: string | null | undefined): string | null {
  if (!rawUnit) return null;
  return normalizeUnit(rawUnit) ?? rawUnit.trim().toLowerCase();
}