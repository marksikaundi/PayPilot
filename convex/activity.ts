import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { logActivity } from "./lib/activityLog";
import { activityDto } from "./lib/validators";
import { requireWorkspace } from "./lib/workspace";

export const list = query({
  args: { accessKey: v.string() },
  returns: v.array(activityDto),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const rows = await ctx.db
      .query("activity")
      .withIndex("by_workspace_and_created", (q) => q.eq("workspaceId", workspace._id))
      .order("desc")
      .take(80);
    return await Promise.all(rows.map((row) => toActivityDto(ctx, row)));
  },
});

export const listForInvoice = query({
  args: { accessKey: v.string(), invoiceId: v.id("invoices") },
  returns: v.array(activityDto),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.workspaceId !== workspace._id) return [];
    const rows = await ctx.db
      .query("activity")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.invoiceId))
      .order("desc")
      .take(40);
    return await Promise.all(rows.map((row) => toActivityDto(ctx, row)));
  },
});

export const resolveReminder = mutation({
  args: {
    accessKey: v.string(),
    activityId: v.id("activity"),
    decision: v.union(v.literal("approved"), v.literal("dismissed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const activity = await ctx.db.get(args.activityId);
    if (!activity || activity.workspaceId !== workspace._id) {
      throw new Error("That suggestion is not in this workspace.");
    }
    if (activity.approvalStatus !== "pending" || !activity.reminderId) {
      throw new Error("This suggestion was already resolved.");
    }
    const reminder = await ctx.db.get(activity.reminderId);
    if (!reminder || reminder.workspaceId !== workspace._id) {
      throw new Error("Reminder not found");
    }
    const approved = args.decision === "approved";
    await ctx.db.patch(reminder._id, {
      status: approved ? "approved" : "dismissed",
      updatedAt: Date.now(),
    });
    await ctx.db.patch(activity._id, {
      approvalStatus: approved ? "approved" : "dismissed",
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: reminder.invoiceId,
      invoiceNumber: activity.invoiceNumber,
      reminderId: reminder._id,
      kind: approved ? "reminder_approved" : "reminder_dismissed",
      actor: "user",
      title: approved
        ? `You approved the reminder for ${activity.invoiceNumber ?? "an invoice"}`
        : `You dismissed the reminder for ${activity.invoiceNumber ?? "an invoice"}`,
      detail: approved
        ? "The reminder stays in the activity log for you to copy. PayPilot does not email it and does not move money."
        : "The reminder was dismissed and will not be treated as approved.",
      approvalStatus: approved ? "approved" : "dismissed",
    });
    return null;
  },
});

export const addReminder = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    invoiceId: v.id("invoices"),
    invoiceNumber: v.string(),
    subject: v.string(),
    body: v.string(),
    actor: v.union(v.literal("ai"), v.literal("system")),
    title: v.string(),
  },
  returns: v.id("reminders"),
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.workspaceId !== args.workspaceId) {
      throw new Error("Invoice not found");
    }
    const reminderId = await ctx.db.insert("reminders", {
      workspaceId: args.workspaceId,
      invoiceId: args.invoiceId,
      subject: args.subject,
      body: args.body,
      status: "draft",
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      invoiceId: args.invoiceId,
      invoiceNumber: args.invoiceNumber,
      reminderId,
      kind: "reminder_drafted",
      actor: args.actor,
      title: args.title,
      detail: "This reminder stays pending until you approve it. Approval does not send email or open PayPal.",
      approvalStatus: "pending",
    });
    return reminderId;
  },
});

export const saveAssistantTurn = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    user: v.string(),
    assistant: v.string(),
    reminders: v.array(
      v.object({
        invoiceId: v.id("invoices"),
        invoiceNumber: v.string(),
        subject: v.string(),
        body: v.string(),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("messages", {
      workspaceId: args.workspaceId,
      role: "user",
      content: args.user,
      createdAt: now,
    });
    await ctx.db.insert("messages", {
      workspaceId: args.workspaceId,
      role: "assistant",
      content: args.assistant,
      createdAt: now + 1,
    });
    for (const reminder of args.reminders) {
      const invoice = await ctx.db.get(reminder.invoiceId);
      if (!invoice || invoice.workspaceId !== args.workspaceId) continue;
      const reminderId = await ctx.db.insert("reminders", {
        workspaceId: args.workspaceId,
        invoiceId: reminder.invoiceId,
        subject: reminder.subject,
        body: reminder.body,
        status: "draft",
        updatedAt: now,
      });
      await logActivity(ctx, {
        workspaceId: args.workspaceId,
        invoiceId: reminder.invoiceId,
        invoiceNumber: reminder.invoiceNumber,
        reminderId,
        kind: "reminder_drafted",
        actor: "ai",
        title: `Reminder drafted for ${reminder.invoiceNumber}`,
        detail: "The assistant suggested this reminder. It stays pending until you approve it.",
        approvalStatus: "pending",
        createdAt: now,
      });
    }
    return args.reminders.length;
  },
});

async function toActivityDto(ctx: QueryCtx, row: Doc<"activity">) {
  const reminder = row.reminderId ? await ctx.db.get(row.reminderId) : null;
  return {
    _id: row._id,
    invoiceId: row.invoiceId ?? null,
    invoiceNumber: row.invoiceNumber ?? null,
    reminderId: row.reminderId ?? null,
    kind: row.kind,
    actor: row.actor,
    title: row.title,
    detail: row.detail,
    approvalStatus: row.approvalStatus,
    createdAt: row.createdAt,
    reminderSubject: reminder?.subject ?? null,
    reminderBody: reminder?.body ?? null,
    reminderStatus: reminder?.status ?? null,
  };
}
