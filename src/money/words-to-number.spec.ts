import { wordsToNumber, isSingleDigitWord } from './words-to-number';

describe('wordsToNumber', () => {
  it('parses plain digits', () => {
    expect(wordsToNumber('8')).toBe(8);
    expect(wordsToNumber('4,500')).toBe(4500);
  });

  it('parses simple number words', () => {
    expect(wordsToNumber('three')).toBe(3);
    expect(wordsToNumber('fourteen')).toBe(14);
  });

  it('parses tens compounded with words', () => {
    expect(wordsToNumber('forty five')).toBe(45);
    expect(wordsToNumber('twenty-three')).toBe(23);
  });

  it('parses colloquial "one fifty" as 150', () => {
    expect(wordsToNumber('one fifty')).toBe(150);
  });

  it('parses hundreds', () => {
    expect(wordsToNumber('one hundred fifty')).toBe(150);
    expect(wordsToNumber('two hundred')).toBe(200);
  });

  it('parses thousands and millions', () => {
    expect(wordsToNumber('three thousand')).toBe(3000);
    expect(wordsToNumber('one million')).toBe(1_000_000);
    expect(wordsToNumber('forty five thousand')).toBe(45_000);
  });

  it('parses decimal points', () => {
    expect(wordsToNumber('two point five')).toBe(2.5);
    expect(wordsToNumber('two point five zero')).toBe(2.5);
  });

  it('returns null on garbage', () => {
    expect(wordsToNumber('banana mango')).toBeNull();
    expect(wordsToNumber('')).toBe(0);
  });
});

describe('isSingleDigitWord', () => {
  it('recognizes single digit words only', () => {
    expect(isSingleDigitWord('one')).toBe(true);
    expect(isSingleDigitWord('ten')).toBe(false);
    expect(isSingleDigitWord('fifty')).toBe(false);
  });
});