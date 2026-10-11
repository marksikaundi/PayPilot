import { v } from "convex/values";

export const invoiceStatus = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("sent"),
  v.literal("overdue"),
  v.literal("paid"),
  v.literal("void"),
);

export const paymentStatus = v.union(
  v.literal("created"),
  v.literal("captured"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const reminderStatus = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("dismissed"),
);

export const actor = v.union(
  v.literal("ai"),
  v.literal("user"),
  v.literal("paypal"),
  v.literal("system"),
);

export const approvalStatus = v.union(
  v.literal("none"),
  v.literal("pending"),
  v.literal("approved"),
  v.literal("dismissed"),
);

export const activityKind = v.union(
  v.literal("invoice_drafted"),
  v.literal("invoice_edited"),
  v.literal("invoice_approved"),
  v.literal("invoice_discarded"),
  v.literal("checkout_started"),
  v.literal("checkout_cancelled"),
  v.literal("payment_captured"),
  v.literal("payment_rejected"),
  v.literal("overdue_flagged"),
  v.literal("reminder_drafted"),
  v.literal("reminder_approved"),
  v.literal("reminder_dismissed"),
);

export const lineItemInput = v.object({
  description: v.string(),
  quantity: v.number(),
  unitAmountCents: v.number(),
});

export const invoiceDto = v.object({
  _id: v.id("invoices"),
  number: v.string(),
  clientName: v.string(),
  clientEmail: v.string(),
  currency: v.literal("USD"),
  notes: v.string(),
  dueDate: v.string(),
  status: invoiceStatus,
  sourcePrompt: v.union(v.string(), v.null()),
  totalCents: v.number(),
  paidOn: v.union(v.string(), v.null()),
  updatedAt: v.number(),
});

export const lineItemDto = v.object({
  description: v.string(),
  quantity: v.number(),
  unitAmountCents: v.number(),
});

export const paymentDto = v.object({
  status: paymentStatus,
  paypalOrderId: v.string(),
  amountCents: v.number(),
  captureId: v.union(v.string(), v.null()),
  payerEmail: v.union(v.string(), v.null()),
  failureReason: v.union(v.string(), v.null()),
});

export const reminderDto = v.object({
  _id: v.id("reminders"),
  invoiceId: v.id("invoices"),
  subject: v.string(),
  body: v.string(),
  status: reminderStatus,
});

export const activityDto = v.object({
  _id: v.id("activity"),
  invoiceId: v.union(v.id("invoices"), v.null()),
  invoiceNumber: v.union(v.string(), v.null()),
  reminderId: v.union(v.id("reminders"), v.null()),
  kind: activityKind,
  actor,
  title: v.string(),
  detail: v.string(),
  approvalStatus,
  createdAt: v.number(),
  reminderSubject: v.union(v.string(), v.null()),
  reminderBody: v.union(v.string(), v.null()),
  reminderStatus: v.union(reminderStatus, v.null()),
});
