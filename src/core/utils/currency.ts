export const toCents = (value: number): number => {
  if (!Number.isFinite(value)) {
    throw new Error("El valor monetario debe ser un número finito.");
  }
  return Math.round(value * 100);
};

export const centsToAmount = (cents: number): number => {
  if (!Number.isFinite(cents)) {
    throw new Error("El valor en centavos debe ser un número finito.");
  }
  return Number((cents / 100).toFixed(2));
};
