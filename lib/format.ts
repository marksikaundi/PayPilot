const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatMoney(cents: number): string {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const fraction = String(abs % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}$${whole}.${fraction}`;
}

export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1] ?? match[2];
  return `${month} ${Number(match[3])}, ${match[1]}`;
}

export function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const month = MONTHS[date.getUTCMonth()] ?? "";
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${month} ${date.getUTCDate()}, ${hours}:${minutes} UTC`;
}

export function parseDollars(value: string): number | null {
  const trimmed = value.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  if (whole === undefined || whole === "") return null;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function parseQuantity(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const quantity = Number(value.trim());
  if (quantity < 1 || quantity > 10000) return null;
  return quantity;
}

export function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Awaiting payment",
  overdue: "Overdue",
  paid: "Paid",
  void: "Discarded",
};
