import type { MoneyRoundingMode } from '@/domain/entities';

const CURRENCY_PATTERN = /^\d+(?:\.\d{1,2})?$/;

export function parseCurrencyToMinor(value: string): number {
  const normalized = value.trim();
  if (!CURRENCY_PATTERN.test(normalized)) throw new Error('Enter a non-negative amount with at most two decimal places.');
  const [whole = '0', fraction = ''] = normalized.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large.');
  return Number(minor);
}

export function formatMinorUnits(value: number, currency = 'ILS', locale: 'he' | 'en' | string = 'he'): string {
  const language = locale === 'he' ? 'he-IL' : locale === 'en' ? 'en-US' : locale;
  return new Intl.NumberFormat(language, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / 100);
}

export function roundRationalToMinor(numerator: bigint, denominator: bigint, mode: MoneyRoundingMode): number {
  if (numerator < 0n || denominator <= 0n) throw new Error('Money arithmetic requires a non-negative numerator and positive denominator.');
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded = mode === 'floor' || remainder === 0n
    ? quotient
    : mode === 'ceiling' || remainder * 2n >= denominator
      ? quotient + 1n
      : quotient;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Calculated amount exceeds the safe integer range.');
  return Number(rounded);
}

export function calculateMinutePay(rateMinor: number, minutes: number, basisPoints: number, mode: MoneyRoundingMode): number {
  return roundRationalToMinor(BigInt(rateMinor) * BigInt(minutes) * BigInt(basisPoints), 60n * 10_000n, mode);
}

export function parsePercentageToBasisPoints(value: string): number {
  const normalized = value.trim();
  if (!CURRENCY_PATTERN.test(normalized)) throw new Error('Enter a positive percentage with at most two decimal places.');
  const basisPoints = parseCurrencyToMinor(normalized);
  if (basisPoints <= 0) throw new Error('Percentage must be positive.');
  return basisPoints;
}
