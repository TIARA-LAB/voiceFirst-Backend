import { parseNairaValue, parseNairaToKobo, findMoneyInPhrase } from './money.normalizer';

describe('parseNairaValue', () => {
  it('parses "45k" shorthand as 45,000 naira', () => {
    expect(parseNairaValue('45k')).toBe(45_000);
  });

  it('parses "forty-five k" as 45,000 naira', () => {
    expect(parseNairaValue('forty-five k')).toBe(45_000);
  });

  it('parses "3k" as 3,000 naira', () => {
    expect(parseNairaValue('3k')).toBe(3_000);
  });

  it('parses "three thousand"', () => {
    expect(parseNairaValue('three thousand')).toBe(3_000);
  });

  it('parses "4,500" as 4,500 naira', () => {
    expect(parseNairaValue('4,500')).toBe(4_500);
  });

  it('parses "₦15,000"', () => {
    expect(parseNairaValue('₦15,000')).toBe(15_000);
  });

  it('parses "one fifty" colloquial', () => {
    expect(parseNairaValue('one fifty')).toBe(150);
  });

  it('returns null for unparseable text', () => {
    expect(parseNairaValue('not money')).toBeNull();
    expect(parseNairaValue(null)).toBeNull();
    expect(parseNairaValue('')).toBeNull();
  });
});

describe('parseNairaToKobo', () => {
  it('converts naira to integer kobo', () => {
    expect(parseNairaToKobo('45k')).toBe(4_500_000);
    expect(parseNairaToKobo('two point five')).toBe(250);
    expect(parseNairaToKobo('100')).toBe(10_000);
  });

  it('returns null when unparseable', () => {
    expect(parseNairaToKobo('no amount')).toBeNull();
  });
});

describe('findMoneyInPhrase', () => {
  it('extracts a money amount from surroundings', () => {
    const part = findMoneyInPhrase('three bags of rice at 45k each');
    expect(part).not.toBeNull();
    expect(part?.kobo).toBe(4_500_000);
  });

  it('returns null when none present', () => {
    expect(findMoneyInPhrase('no figures in this sentence')).toBeNull();
  });
});