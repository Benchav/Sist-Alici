export const toCents = (value: number): number => Math.round(value * 100);

export const fromCents = (cents: number): number => cents / 100;
