/**
 * Date/time helpers honouring a business timezone (default Africa/Lagos).
 */

export function utcOffsetMinutes(timezone: string, date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const read = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour') % 24,
    read('minute'),
    read('second'),
  );
  return (asUtc - date.getTime()) / 60_000;
}

export function startOfDayInTz(date: Date, timezone: string): Date {
  const offset = utcOffsetMinutes(timezone, date);
  const utcMidnight = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return new Date(utcMidnight.getTime() - offset * 60_000);
}

export function endOfDayInTz(date: Date, timezone: string): Date {
  return new Date(startOfDayInTz(date, timezone).getTime() + 86_400_000 - 1);
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}