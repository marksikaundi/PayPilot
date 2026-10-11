export function centsToDecimal(cents: number): string {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}${whole}.${fraction}`;
}

export function decimalToCents(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (whole === undefined) return null;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function dollarsToCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }
  if (typeof value === "string") return decimalToCents(value.trim());
  return null;
}
