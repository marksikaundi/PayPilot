import { isRecord } from "./fields";
import { decimalToCents } from "./money";

const SANDBOX = "https://api-m.sandbox.paypal.com";

export function paypalBase(): string {
  const configured = (process.env.PAYPAL_API_BASE ?? SANDBOX).replace(/\/$/, "");
  if (configured !== SANDBOX) {
    throw new Error(
      "PayPilot only calls the PayPal sandbox at api-m.sandbox.paypal.com.",
    );
  }
  return configured;
}

export function appUrl(): string {
  const url = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!/^https?:\/\//.test(url)) {
    throw new Error("APP_URL must start with http:// or https://");
  }
  return url;
}

function credentials(): { clientId: string; secret: string } {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) {
    throw new Error(
      "Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to your Convex deployment. Create a REST app in the PayPal sandbox.",
    );
  }
  return { clientId, secret };
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function paypalMessage(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    if (Array.isArray(payload.details)) {
      const detail = payload.details.find(
        (item) => isRecord(item) && typeof item.description === "string",
      );
      if (isRecord(detail) && typeof detail.description === "string") {
        return detail.description;
      }
    }
    if (typeof payload.message === "string" && payload.message) return payload.message;
    if (typeof payload.error_description === "string") return payload.error_description;
  }
  return `PayPal request failed (${status}). Check the sandbox credentials.`;
}

export function isAlreadyCaptured(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  if (payload.name === "ORDER_ALREADY_CAPTURED") return true;
  if (!Array.isArray(payload.details)) return false;
  return payload.details.some(
    (detail) => isRecord(detail) && detail.issue === "ORDER_ALREADY_CAPTURED",
  );
}

export async function paypalAccessToken(): Promise<string> {
  const { clientId, secret } = credentials();
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const payload = await readBody(response);
  if (!response.ok || !isRecord(payload) || typeof payload.access_token !== "string") {
    throw new Error(paypalMessage(payload, response.status));
  }
  return payload.access_token;
}

export async function paypalRequest(
  path: string,
  token: string,
  init?: { method?: "GET" | "POST"; body?: unknown; requestId?: string },
): Promise<unknown> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  if (init?.requestId) headers["PayPal-Request-Id"] = init.requestId;

  const response = await fetch(`${paypalBase()}${path}`, {
    method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
    headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = await readBody(response);
  if (!response.ok) {
    const error = new Error(paypalMessage(payload, response.status));
    (error as Error & { payload?: unknown }).payload = payload;
    throw error;
  }
  return payload;
}

export type VerifiedCapture = {
  captureId: string;
  captureStatus: string;
  amountCents: number;
  currency: string;
  payerEmail: string | null;
  referenceId: string;
  customId: string;
};

export function readCapture(order: unknown): VerifiedCapture | null {
  if (!isRecord(order) || !Array.isArray(order.purchase_units)) return null;
  const unit = order.purchase_units[0];
  if (!isRecord(unit) || !isRecord(unit.payments) || !Array.isArray(unit.payments.captures)) {
    return null;
  }
  const capture = unit.payments.captures[0];
  if (!isRecord(capture) || typeof capture.id !== "string" || typeof capture.status !== "string") {
    return null;
  }
  if (!isRecord(capture.amount) || typeof capture.amount.value !== "string") return null;
  const currency =
    typeof capture.amount.currency_code === "string" ? capture.amount.currency_code : "";
  const amountCents = decimalToCents(capture.amount.value);
  if (amountCents === null) return null;
  const payer = isRecord(order.payer) ? order.payer : null;
  const payerEmail =
    payer && typeof payer.email_address === "string" ? payer.email_address : null;

  return {
    captureId: capture.id,
    captureStatus: capture.status,
    amountCents,
    currency,
    payerEmail,
    referenceId: typeof unit.reference_id === "string" ? unit.reference_id : "",
    customId: typeof unit.custom_id === "string" ? unit.custom_id : "",
  };
}
