// Exact conversion between the app's integer minor units (cents) and PostgreSQL
// numeric(…, 2) values, which Drizzle returns as strings. No floating point.

/** 42000 → "420.00" */
export function minorToDecimal(minor: number): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Amount must be an integer number of minor units: ${minor}`);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** "420.00" → 42000 */
export function decimalToMinor(value: string): number {
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError(`Not a decimal amount with at most 2 places: ${value}`);
  const [, sign, whole, fraction = ""] = match;
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Amount out of range: ${value}`);
  return sign ? -minor : minor;
}
