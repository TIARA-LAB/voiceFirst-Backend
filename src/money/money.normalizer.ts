import { wordsToNumber } from './words-to-number';

/**
 * Normalize a Nigerian money expression into a naira amount and, from there, into
 * integer kobo.
 *
 * Examples:
 *   "45k"            -> 45,000 naira -> 4,500,000 kobo
 *   "forty-five k"   -> 45,000 naira -> 4,500,000 kobo
 *   "3k"             -> 3,000 naira  -> 300,000 kobo
 *   "three thousand" -> 3,000 naira  -> 300,000 kobo
 *   "4,500"          -> 4,500 naira  -> 450,000 kobo
 *   "₦15,000"        -> 15,000 naira -> 1,500,000 kobo
 *   "one fifty"      -> 150 naira    -> 15,000 kobo
 *   "two point five" -> 2.5 naira    -> 250 kobo
 */
export function parseNairaValue(text: string | null | undefined): number | null {
  if (!text) return null;
  let t = text.trim();
  if (!t) return null;

  // Strip currency symbols / words.
  t = t
    .replace(/^₦\s*/g, '')
    .replace(/^NGN\s*$/i, '')
    .replace(/^n\s*/i, '')
    .replace(/^naira\s*/i, '')
    .replace(/\s*(naira|NGN)\s*$/i, '')
    .replace(/,/g, '')
    .trim();

  if (!t) return null;

  const lower = t.toLowerCase();

  // Trailing "k" shorthand for thousand naira ("45k", "forty-five k").
  let thousandShorthand = false;
  if (/k\s*$/.test(lower)) {
    thousandShorthand = true;
    t = t.slice(0, -1).trim();
  }

  const numeric = Number(t.replace(/\s/g, ''));
  let naira: number;
  if (Number.isFinite(numeric) && /^[\d.]+$/.test(t.replace(/\s/g, ''))) {
    naira = numeric;
  } else {
    const parsed = wordsToNumber(t);
    if (parsed === null) return null;
    naira = parsed;
  }

  if (thousandShorthand) {
    naira *= 1000;
  }

  return naira;
}

/** Returns the amount converted to integer kobo, or null when unparseable. */
export function parseNairaToKobo(text: string | null | undefined): number | null {
  const naira = parseNairaValue(text);
  if (naira === null) return null;
  return Math.round(naira * 100);
}

export interface MoneyPart {
  kobo: number | null;
  naira: number | null;
  raw: string;
}

/**
 * Sweeps a free-text phrase for a money amount. Digits and "k" shorthand win first
 * ("45k", "₦15,000"); otherwise spelled-out amounts such as "forty five k" or
 * "one fifty" are picked out of the words (windows of money tokens only, so plain
 * words like "three bags" do not accidentally become amounts).
 */
export function findMoneyInPhrase(phrase: string | null | undefined): MoneyPart | null {
  if (!phrase) return null;

  // 1) Compact numeric forms: "45k", "4,500", "₦15,000", "3 thousand".
  const compact = phrase.match(/(₦|NGN\s*)?\s*\d[\d,]*(?:\.\d+)?\s*(?:k\b|thousand|million)?/gi);
  if (compact) {
    for (const raw of compact) {
      const naira = parseNairaValue(raw);
      if (naira !== null) {
        return { naira, kobo: Math.round(naira * 100), raw: raw.trim() };
      }
    }
  }

  // 2) Spelled-out amounts written as multiple money words.
  const moneyWords = new Set([
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen', 'twenty', 'thirty', 'forty', 'fifty',
    'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand', 'million',
    'point', 'k', 'naira', 'ngn',
  ]);

  const tokens = phrase
    .replace(/,/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase().replace(/[^a-z0-9.]/g, ''))
    .filter((t) => t.length > 0 && (moneyWords.has(t) || /^\d+(\.\d+)?$/.test(t)));

  for (let start = 0; start < tokens.length - 1; start++) {
    for (let len = 2; len <= Math.min(6, tokens.length - start); len++) {
      const raw = tokens.slice(start, start + len).join(' ');
      const naira = parseNairaValue(raw);
      if (naira !== null) {
        return { naira, kobo: Math.round(naira * 100), raw };
      }
    }
  }

  return null;
}