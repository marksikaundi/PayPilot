export type LineInput = {
  description: string;
  quantity: number;
  unitAmountCents: number;
};

export type InvoiceStatus =
  | "draft"
  | "approved"
  | "sent"
  | "overdue"
  | "paid"
  | "void";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export function assertDate(value: string, label: string): string {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new Error(`${label} must use a YYYY-MM-DD date`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} is not a real calendar date`);
  }
  return value;
}

export function assertMonth(value: string): string {
  const match = MONTH_PATTERN.exec(value);
  if (!match) throw new Error("Month must use a YYYY-MM value");
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error("Month must use a YYYY-MM value");
  return value;
}

export function assertClientName(value: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 120) {
    throw new Error("Client name must be between 1 and 120 characters");
  }
  return name;
}

export function assertEmail(value: string, required: boolean): string {
  const email = value.trim();
  if (!email && !required) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    throw new Error("Enter a valid client email before approving this invoice");
  }
  return email;
}

export function assertNotes(value: string): string {
  const notes = value.trim();
  if (notes.length > 1000) throw new Error("Notes must be under 1000 characters");
  return notes;
}

export function assertLineItems(
  items: LineInput[],
  mode: "draft" | "approve",
): LineInput[] {
  if (items.length < 1 || items.length > 20) {
    throw new Error("An invoice needs between 1 and 20 line items");
  }

  return items.map((item, index) => {
    const description = item.description.trim();
    const line = `Line ${index + 1}`;
    if (description.length < 1 || description.length > 200) {
      throw new Error(`${line} needs a description under 200 characters`);
    }
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10000
    ) {
      throw new Error(`${line} quantity must be a whole number from 1 to 10000`);
    }
    if (
      !Number.isInteger(item.unitAmountCents) ||
      item.unitAmountCents < 0 ||
      item.unitAmountCents > 10_000_000
    ) {
      throw new Error(`${line} price must be between $0.00 and $100,000.00`);
    }
    if (mode === "approve" && item.unitAmountCents < 1) {
      throw new Error(`${line} needs a price greater than $0.00 before approval`);
    }
    return {
      description,
      quantity: item.quantity,
      unitAmountCents: item.unitAmountCents,
    };
  });
}

export function totalCents(items: LineInput[]): number {
  return items.reduce(
    (sum, item) => sum + item.quantity * item.unitAmountCents,
    0,
  );
}

export function checkoutBlockers(invoice: {
  status: InvoiceStatus;
  clientEmail: string;
  totalCents: number;
}): string[] {
  const blockers: string[] = [];
  if (invoice.status === "draft") {
    blockers.push("Approve the invoice before opening PayPal.");
  }
  if (invoice.status === "void") blockers.push("This invoice was discarded.");
  if (invoice.status === "paid") blockers.push("This invoice is already paid.");
  if (!invoice.clientEmail) {
    blockers.push("Add a client email before collecting payment.");
  }
  if (invoice.totalCents <= 0) {
    blockers.push("The invoice total must be greater than $0.00.");
  }
  if (invoice.totalCents > 10_000_000) {
    blockers.push("Sandbox checkout is limited to $100,000.00.");
  }
  return blockers;
}

export function isoDaysFromToday(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysUntil(today: string, dueDate: string): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  return Math.round((due - start) / 86_400_000);
}

export function shiftMonth(month: string, delta: number): string {
  const [yearText, monthText] = month.split("-");
  const index = Number(yearText) * 12 + (Number(monthText) - 1) + delta;
  const year = Math.floor(index / 12);
  const nextMonth = index % 12;
  return `${year}-${String(nextMonth + 1).padStart(2, "0")}`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const candidates = [trimmed];
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (isRecord(parsed)) return parsed;
    } catch {
      continue;
    }
  }

  throw new Error(
    "The model returned an unreadable response. Try a more specific description.",
  );
}

export function clipText(value: unknown, max: number, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} was missing from the model response`);
  const text = value.trim();
  if (!text) throw new Error(`${label} was empty in the model response`);
  if (text.length > max) return text.slice(0, max);
  return text;
}
