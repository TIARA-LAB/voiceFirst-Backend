export function formatNaira(kobo: number | null | undefined): string | null {
  if (kobo === null || kobo === undefined) return null;
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

export function toKobo(naira: number): number {
  return Math.round(naira * 100);
}