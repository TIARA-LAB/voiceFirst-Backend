const SIMPLE: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const SINGLE_DIGITS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/**
 * Converts English / Nigerian English number words to a number.
 *
 * Supported forms:
 *  - "forty five"            -> 45
 *  - "one hundred fifty"     -> 150
 *  - "one fifty" (colloquial)-> 150
 *  - "three thousand"        -> 3000
 *  - "two point five"        -> 2.5
 *  - "8"                     -> 8
 *
 * Returns null when an unknown token is encountered.
 */
export function wordsToNumber(input: string): number | null {
  const tokens = input
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/,/g, '')
    .split(/\s+/)
    .filter(Boolean);

  let result = 0;
  let current = 0;
  let decimal = 0;
  let decimalDivisor = 1;
  let inDecimal = false;

  for (const token of tokens) {
    if (token === 'point') {
      inDecimal = true;
      continue;
    }

    if (inDecimal) {
      const value = token in SIMPLE && SIMPLE[token] < 10 ? SIMPLE[token] : Number(token);
      if (!Number.isFinite(value)) return null;
      decimalDivisor *= 10;
      decimal += value / decimalDivisor;
      continue;
    }

    if (/^\d+(\.\d+)?$/.test(token)) {
      current = Number(token);
      continue;
    }
    if (token in SIMPLE) {
      current += SIMPLE[token];
      continue;
    }
    if (token in TENS) {
      // Colloquial form: digit + tens -> hundreds ("one fifty" = 150)
      current = current > 0 && current < 10 ? current * 100 + TENS[token] : current + TENS[token];
      continue;
    }
    if (token === 'hundred') {
      current = (current || 1) * 100;
      continue;
    }
    if (token.toLowerCase() === 'thousand') {
      result += Math.max(current, 1) * 1000;
      current = 0;
      continue;
    }
    if (token.toLowerCase() === 'million') {
      result += Math.max(current, 1) * 1_000_000;
      current = 0;
      continue;
    }
    return null;
  }

  if (inDecimal && decimalDivisor === 1) return null;
  return result + current + decimal;
}

/** True when the text is a valid single digit word (used for the "X-fifty" heuristic). */
export function isSingleDigitWord(token: string): boolean {
  return SINGLE_DIGITS.includes(token.toLowerCase());
}