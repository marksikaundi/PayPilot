import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  activityKind,
  actor,
  approvalStatus,
  invoiceStatus,
  paymentStatus,
  reminderStatus,
} from "./lib/validators";

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    accessKey: v.string(),
    nextNumber: v.number(),
    createdAt: v.number(),
  }).index("by_access_key", ["accessKey"]),

  invoices: defineTable({
    workspaceId: v.id("workspaces"),
    number: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    currency: v.literal("USD"),
    notes: v.string(),
    dueDate: v.string(),
    status: invoiceStatus,
    sourcePrompt: v.optional(v.string()),
    totalCents: v.number(),
    paidOn: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_and_status", ["workspaceId", "status"]),

  lineItems: defineTable({
    invoiceId: v.id("invoices"),
    workspaceId: v.id("workspaces"),
    description: v.string(),
    quantity: v.number(),
    unitAmountCents: v.number(),
    position: v.number(),
  }).index("by_invoice", ["invoiceId"]),

  payments: defineTable({
    invoiceId: v.id("invoices"),
    workspaceId: v.id("workspaces"),
    paypalOrderId: v.string(),
    status: paymentStatus,
    amountCents: v.number(),
    currency: v.literal("USD"),
    captureId: v.optional(v.string()),
    payerEmail: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_invoice", ["invoiceId"])
    .index("by_paypal_order", ["paypalOrderId"]),

  reminders: defineTable({
    workspaceId: v.id("workspaces"),
    invoiceId: v.id("invoices"),
    subject: v.string(),
    body: v.string(),
    status: reminderStatus,
    updatedAt: v.number(),
  }).index("by_invoice", ["invoiceId"]),

  activity: defineTable({
    workspaceId: v.id("workspaces"),
    invoiceId: v.optional(v.id("invoices")),
    invoiceNumber: v.optional(v.string()),
    reminderId: v.optional(v.id("reminders")),
    kind: activityKind,
    actor,
    title: v.string(),
    detail: v.string(),
    approvalStatus,
    createdAt: v.number(),
  })
    .index("by_workspace_and_created", ["workspaceId", "createdAt"])
    .index("by_invoice", ["invoiceId"]),

  messages: defineTable({
    workspaceId: v.id("workspaces"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_workspace_and_created", ["workspaceId", "createdAt"]),
});
