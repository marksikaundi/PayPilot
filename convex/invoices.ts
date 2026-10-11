import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { logActivity } from "./lib/activityLog";
import {
  assertClientName,
  assertDate,
  assertEmail,
  assertLineItems,
  assertMonth,
  assertNotes,
  checkoutBlockers,
  shiftMonth,
  todayIso,
  totalCents,
} from "./lib/fields";
import {
  assertPayable,
  insertInvoice,
  loadLineItems,
  nextInvoiceNumber,
  ownedInvoice,
  replaceLineItems,
  toInvoiceDto,
} from "./lib/invoiceWrite";
import { lineItemInput, invoiceDto, lineItemDto, paymentDto, reminderDto } from "./lib/validators";
import { requireWorkspace } from "./lib/workspace";

const MONTH_LABELS = [
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

export const list = query({
  args: {
    accessKey: v.string(),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("approved"),
        v.literal("sent"),
        v.literal("overdue"),
        v.literal("paid"),
        v.literal("void"),
      ),
    ),
    search: v.optional(v.string()),
  },
  returns: v.array(invoiceDto),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const rows = args.status
      ? await ctx.db
          .query("invoices")
          .withIndex("by_workspace_and_status", (q) =>
            q.eq("workspaceId", workspace._id).eq("status", args.status!),
          )
          .order("desc")
          .take(100)
      : await ctx.db
          .query("invoices")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
          .order("desc")
          .take(100);

    const needle = (args.search ?? "").trim().toLowerCase().slice(0, 80);
    const filtered = needle
      ? rows.filter((row) =>
          `${row.number} ${row.clientName} ${row.clientEmail}`
            .toLowerCase()
            .includes(needle),
        )
      : rows;
    return filtered.map(toInvoiceDto);
  },
});

export const summary = query({
  args: { accessKey: v.string(), month: v.string() },
  returns: v.object({
    outstandingCents: v.number(),
    overdueCents: v.number(),
    paidCents: v.number(),
    invoiceCount: v.number(),
    overdueCount: v.number(),
    paidCount: v.number(),
    awaitingCount: v.number(),
    draftCount: v.number(),
    months: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        paidCents: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const month = assertMonth(args.month);
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .take(200);

    const keys = [-3, -2, -1, 0].map((delta) => shiftMonth(month, delta));
    const buckets = new Map(keys.map((key) => [key, 0]));
    let outstandingCents = 0;
    let overdueCents = 0;
    let paidCents = 0;
    let overdueCount = 0;
    let paidCount = 0;
    let awaitingCount = 0;
    let draftCount = 0;

    for (const invoice of invoices) {
      if (invoice.status === "void") continue;
      if (invoice.status === "draft") draftCount += 1;
      if (invoice.status === "paid") {
        paidCount += 1;
        paidCents += invoice.totalCents;
        if (invoice.paidOn) {
          const key = invoice.paidOn.slice(0, 7);
          if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + invoice.totalCents);
        }
      }
      if (
        invoice.status === "approved" ||
        invoice.status === "sent" ||
        invoice.status === "overdue"
      ) {
        outstandingCents += invoice.totalCents;
        awaitingCount += 1;
      }
      if (invoice.status === "overdue") {
        overdueCount += 1;
        overdueCents += invoice.totalCents;
      }
    }

    return {
      outstandingCents,
      overdueCents,
      paidCents,
      invoiceCount: invoices.filter((invoice) => invoice.status !== "void").length,
      overdueCount,
      paidCount,
      awaitingCount,
      draftCount,
      months: keys.map((key) => ({
        key,
        label: MONTH_LABELS[Number(key.slice(5, 7)) - 1] ?? key,
        paidCents: buckets.get(key) ?? 0,
      })),
    };
  },
});

export const get = query({
  args: { accessKey: v.string(), invoiceId: v.id("invoices") },
  returns: v.union(
    v.object({
      invoice: invoiceDto,
      lineItems: v.array(lineItemDto),
      blockers: v.array(v.string()),
      payment: v.union(paymentDto, v.null()),
      reminders: v.array(reminderDto),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.workspaceId !== workspace._id) return null;

    const lineItems = await loadLineItems(ctx, invoice._id);
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
      .order("desc")
      .take(1);
    const payment = payments[0];
    const reminders = await ctx.db
      .query("reminders")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
      .order("desc")
      .take(10);

    return {
      invoice: toInvoiceDto(invoice),
      lineItems,
      blockers: checkoutBlockers(invoice),
      payment: payment
        ? {
            status: payment.status,
            paypalOrderId: payment.paypalOrderId,
            amountCents: payment.amountCents,
            captureId: payment.captureId ?? null,
            payerEmail: payment.payerEmail ?? null,
            failureReason: payment.failureReason ?? null,
          }
        : null,
      reminders: reminders.map((reminder) => ({
        _id: reminder._id,
        invoiceId: reminder.invoiceId,
        subject: reminder.subject,
        body: reminder.body,
        status: reminder.status,
      })),
    };
  },
});

export const createBlank = mutation({
  args: { accessKey: v.string() },
  returns: v.id("invoices"),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const number = await nextInvoiceNumber(ctx, workspace);
    const invoiceId = await insertInvoice(ctx, {
      workspaceId: workspace._id,
      number,
      clientName: "Untitled client",
      clientEmail: "",
      notes: "",
      dueDate: isoOffset(14),
      status: "draft",
      lineItems: [{ description: "Describe the work", quantity: 1, unitAmountCents: 0 }],
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId,
      invoiceNumber: number,
      kind: "invoice_drafted",
      actor: "user",
      title: `Blank draft ${number} created`,
      detail: "Fill in the client, the work, and the price, then approve it.",
      approvalStatus: "none",
    });
    return invoiceId;
  },
});

export const updateDraft = mutation({
  args: {
    accessKey: v.string(),
    invoiceId: v.id("invoices"),
    clientName: v.string(),
    clientEmail: v.string(),
    dueDate: v.string(),
    notes: v.string(),
    lineItems: v.array(lineItemInput),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const invoice = await ownedInvoice(ctx, workspace._id, args.invoiceId);
    if (invoice.status !== "draft") {
      throw new Error("Only drafts can be edited. Approve locks the line items.");
    }
    const lineItems = assertLineItems(args.lineItems, "draft");
    const total = await replaceLineItems(ctx, workspace._id, invoice._id, lineItems);
    await ctx.db.patch(invoice._id, {
      clientName: assertClientName(args.clientName),
      clientEmail: assertEmail(args.clientEmail, false),
      dueDate: assertDate(args.dueDate, "Due date"),
      notes: assertNotes(args.notes),
      totalCents: total,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: invoice._id,
      invoiceNumber: invoice.number,
      kind: "invoice_edited",
      actor: "user",
      title: `You edited ${invoice.number}`,
      detail: "The draft was saved. It still needs approval before PayPal can collect it.",
      approvalStatus: "none",
    });
    return null;
  },
});

export const approve = mutation({
  args: { accessKey: v.string(), invoiceId: v.id("invoices") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const invoice = await ownedInvoice(ctx, workspace._id, args.invoiceId);
    if (invoice.status !== "draft") {
      throw new Error("This invoice is already past the draft step.");
    }
    const lineItems = assertLineItems(await loadLineItems(ctx, invoice._id), "approve");
    const clientName = assertClientName(invoice.clientName);
    const clientEmail = assertEmail(invoice.clientEmail, true);
    const dueDate = assertDate(invoice.dueDate, "Due date");
    const total = totalCents(lineItems);
    if (total <= 0 || total > 10_000_000) {
      throw new Error("The invoice total must be between $0.01 and $100,000.00.");
    }
    await ctx.db.patch(invoice._id, {
      clientName,
      clientEmail,
      dueDate,
      totalCents: total,
      status: "approved",
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: invoice._id,
      invoiceNumber: invoice.number,
      kind: "invoice_approved",
      actor: "user",
      title: `You approved ${invoice.number}`,
      detail: "PayPal checkout is now allowed for this exact total. Approval itself does not move money.",
      approvalStatus: "approved",
    });
    return null;
  },
});

export const discard = mutation({
  args: { accessKey: v.string(), invoiceId: v.id("invoices") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const invoice = await ownedInvoice(ctx, workspace._id, args.invoiceId);
    if (invoice.status !== "draft" && invoice.status !== "approved") {
      throw new Error("Only drafts and approved invoices can be discarded.");
    }
    await ctx.db.patch(invoice._id, { status: "void", updatedAt: Date.now() });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: invoice._id,
      invoiceNumber: invoice.number,
      kind: "invoice_discarded",
      actor: "user",
      title: `You discarded ${invoice.number}`,
      detail: "Discarded invoices stay on the record and cannot be collected.",
      approvalStatus: "none",
    });
    return null;
  },
});

export const cancelCheckout = mutation({
  args: { accessKey: v.string(), invoiceId: v.id("invoices") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const invoice = await ownedInvoice(ctx, workspace._id, args.invoiceId);
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
      .order("desc")
      .take(5);
    const open = payments.find((payment) => payment.status === "created");
    if (!open) return null;
    await ctx.db.patch(open._id, {
      status: "cancelled",
      failureReason: "The buyer left PayPal before paying",
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: invoice._id,
      invoiceNumber: invoice.number,
      kind: "checkout_cancelled",
      actor: "user",
      title: `Checkout cancelled for ${invoice.number}`,
      detail: "The buyer returned from PayPal without paying. The invoice is still open.",
      approvalStatus: "none",
    });
    return null;
  },
});

export const invoiceForAgent = internalQuery({
  args: { accessKey: v.string(), invoiceId: v.id("invoices") },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    workspaceName: v.string(),
    invoiceId: v.id("invoices"),
    number: v.string(),
    clientName: v.string(),
    clientEmail: v.string(),
    status: v.string(),
    dueDate: v.string(),
    totalCents: v.number(),
    notes: v.string(),
  }),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const invoice = await ownedInvoice(ctx, workspace._id, args.invoiceId);
    return {
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      invoiceId: invoice._id,
      number: invoice.number,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      status: invoice.status,
      dueDate: invoice.dueDate,
      totalCents: invoice.totalCents,
      notes: invoice.notes,
    };
  },
});

export const refreshOverdue = mutation({
  args: { accessKey: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    return await markOverdue(ctx, workspace._id, todayIso());
  },
});

export const markAllOverdue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const today = todayIso();
    const workspaces = await ctx.db.query("workspaces").take(50);
    for (const workspace of workspaces) {
      await markOverdue(ctx, workspace._id, today);
    }
    return null;
  },
});

export const createFromAgent = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    clientName: v.string(),
    clientEmail: v.string(),
    dueDate: v.string(),
    notes: v.string(),
    sourcePrompt: v.string(),
    lineItems: v.array(lineItemInput),
  },
  returns: v.object({ invoiceId: v.id("invoices"), number: v.string() }),
  handler: async (ctx, args) => {
    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("Workspace not found");
    const lineItems = assertLineItems(args.lineItems, "approve");
    const number = await nextInvoiceNumber(ctx, workspace);
    const invoiceId = await insertInvoice(ctx, {
      workspaceId: workspace._id,
      number,
      clientName: assertClientName(args.clientName),
      clientEmail: assertEmail(args.clientEmail, false),
      notes: assertNotes(args.notes),
      dueDate: assertDate(args.dueDate, "Due date"),
      status: "draft",
      sourcePrompt: args.sourcePrompt.slice(0, 2000),
      lineItems,
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId,
      invoiceNumber: number,
      kind: "invoice_drafted",
      actor: "ai",
      title: `gpt-4o-mini drafted ${number}`,
      detail: "Review the client, line items, and due date. Nothing is collected until you approve it.",
      approvalStatus: "none",
    });
    return { invoiceId, number };
  },
});

export const workspaceForAgent = internalQuery({
  args: { accessKey: v.string() },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    name: v.string(),
  }),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    return { workspaceId: workspace._id, name: workspace.name };
  },
});

export const recordsForAgent = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(
    v.object({
      _id: v.id("invoices"),
      number: v.string(),
      clientName: v.string(),
      clientEmail: v.string(),
      status: v.string(),
      dueDate: v.string(),
      totalCents: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .order("desc")
      .take(40);
    return invoices.map((invoice) => ({
      _id: invoice._id,
      number: invoice.number,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      status: invoice.status,
      dueDate: invoice.dueDate,
      totalCents: invoice.totalCents,
    }));
  },
});

export const payableForCheckout = internalQuery({
  args: { accessKey: v.string(), invoiceId: v.id("invoices") },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    invoiceId: v.id("invoices"),
    number: v.string(),
    clientName: v.string(),
    totalCents: v.number(),
  }),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const invoice = await ownedInvoice(ctx, workspace._id, args.invoiceId);
    const captured = await ctx.db
      .query("payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
      .take(20);
    if (captured.some((payment) => payment.status === "captured")) {
      throw new Error("This invoice is already paid.");
    }
    assertPayable(invoice);
    return {
      workspaceId: workspace._id,
      invoiceId: invoice._id,
      number: invoice.number,
      clientName: invoice.clientName,
      totalCents: invoice.totalCents,
    };
  },
});

export const recordCheckout = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    invoiceId: v.id("invoices"),
    paypalOrderId: v.string(),
    amountCents: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invoice = await ownedInvoice(ctx, args.workspaceId, args.invoiceId);
    assertPayable(invoice);
    if (invoice.totalCents !== args.amountCents) {
      throw new Error("The PayPal order amount does not match the invoice.");
    }
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
      .take(20);
    for (const payment of existing) {
      if (payment.status === "captured") throw new Error("This invoice is already paid.");
      if (payment.status === "created") {
        await ctx.db.patch(payment._id, {
          status: "cancelled",
          failureReason: "Replaced by a new checkout",
          updatedAt: Date.now(),
        });
      }
    }
    await ctx.db.insert("payments", {
      invoiceId: invoice._id,
      workspaceId: args.workspaceId,
      paypalOrderId: args.paypalOrderId,
      status: "created",
      amountCents: args.amountCents,
      currency: "USD",
      updatedAt: Date.now(),
    });
    if (invoice.status !== "overdue") {
      await ctx.db.patch(invoice._id, { status: "sent", updatedAt: Date.now() });
    } else {
      await ctx.db.patch(invoice._id, { updatedAt: Date.now() });
    }
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      invoiceId: invoice._id,
      invoiceNumber: invoice.number,
      kind: "checkout_started",
      actor: "user",
      title: `PayPal checkout opened for ${invoice.number}`,
      detail: `Sandbox order ${args.paypalOrderId} is for the approved total. The invoice stays unpaid until capture.`,
      approvalStatus: "approved",
    });
    return null;
  },
});

export const paymentForCapture = internalQuery({
  args: { accessKey: v.string(), paypalOrderId: v.string() },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    invoiceId: v.id("invoices"),
    number: v.string(),
    totalCents: v.number(),
    paymentStatus: v.string(),
  }),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paypal_order", (q) => q.eq("paypalOrderId", args.paypalOrderId))
      .unique();
    if (!payment || payment.workspaceId !== workspace._id) {
      throw new Error("No PayPal checkout in this workspace matches that order.");
    }
    const invoice = await ownedInvoice(ctx, workspace._id, payment.invoiceId);
    return {
      workspaceId: workspace._id,
      invoiceId: invoice._id,
      number: invoice.number,
      totalCents: invoice.totalCents,
      paymentStatus: payment.status,
    };
  },
});

export const recordCapture = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    paypalOrderId: v.string(),
    captureId: v.string(),
    amountCents: v.number(),
    currency: v.string(),
    payerEmail: v.union(v.string(), v.null()),
    referenceId: v.string(),
    customId: v.string(),
    captureStatus: v.string(),
  },
  returns: v.object({
    invoiceId: v.id("invoices"),
    number: v.string(),
    alreadyPaid: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paypal_order", (q) => q.eq("paypalOrderId", args.paypalOrderId))
      .unique();
    if (!payment || payment.workspaceId !== args.workspaceId) {
      throw new Error("No PayPal checkout in this workspace matches that order.");
    }
    const invoice = await ownedInvoice(ctx, args.workspaceId, payment.invoiceId);
    if (payment.status === "captured" && invoice.status === "paid") {
      return { invoiceId: invoice._id, number: invoice.number, alreadyPaid: true };
    }

    const belongs =
      args.referenceId === invoice._id || args.customId === invoice.number;
    const amountMatches =
      args.currency === "USD" && args.amountCents === invoice.totalCents;
    const completed = args.captureStatus === "COMPLETED";

    if (!belongs || !amountMatches || !completed) {
      const reason = !completed
        ? `PayPal capture status is ${args.captureStatus}. The invoice stays unpaid.`
        : !amountMatches
          ? "The captured amount or currency does not match the invoice."
          : "This PayPal order does not belong to the invoice.";
      await ctx.db.patch(payment._id, {
        status: "failed",
        failureReason: reason,
        updatedAt: Date.now(),
      });
      await logActivity(ctx, {
        workspaceId: args.workspaceId,
        invoiceId: invoice._id,
        invoiceNumber: invoice.number,
        kind: "payment_rejected",
        actor: "paypal",
        title: `Payment for ${invoice.number} was not accepted`,
        detail: reason,
        approvalStatus: "none",
      });
      throw new Error(reason);
    }

    const paidOn = todayIso();
    await ctx.db.patch(payment._id, {
      status: "captured",
      captureId: args.captureId,
      amountCents: args.amountCents,
      updatedAt: Date.now(),
      ...(args.payerEmail ? { payerEmail: args.payerEmail } : {}),
    });
    await ctx.db.patch(invoice._id, {
      status: "paid",
      paidOn,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      invoiceId: invoice._id,
      invoiceNumber: invoice.number,
      kind: "payment_captured",
      actor: "paypal",
      title: `PayPal captured ${invoice.number}`,
      detail: `Capture ${args.captureId} matches the invoice total${
        args.payerEmail ? ` from ${args.payerEmail}` : ""
      }.`,
      approvalStatus: "none",
    });
    return { invoiceId: invoice._id, number: invoice.number, alreadyPaid: false };
  },
});

export const recordCaptureFailure = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    paypalOrderId: v.string(),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_paypal_order", (q) => q.eq("paypalOrderId", args.paypalOrderId))
      .unique();
    if (!payment || payment.workspaceId !== args.workspaceId) return null;
    if (payment.status === "captured") return null;
    const invoice = await ctx.db.get(payment.invoiceId);
    await ctx.db.patch(payment._id, {
      status: "failed",
      failureReason: args.reason,
      updatedAt: Date.now(),
    });
    await logActivity(ctx, {
      workspaceId: args.workspaceId,
      invoiceId: payment.invoiceId,
      invoiceNumber: invoice?.number,
      kind: "payment_rejected",
      actor: "paypal",
      title: `PayPal could not capture ${invoice?.number ?? "the invoice"}`,
      detail: args.reason,
      approvalStatus: "none",
    });
    return null;
  },
});

async function markOverdue(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  today: string,
): Promise<number> {
  let changed = 0;
  for (const status of ["sent", "approved"] as const) {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_workspace_and_status", (q) =>
        q.eq("workspaceId", workspaceId).eq("status", status),
      )
      .take(100);
    for (const invoice of invoices) {
      if (invoice.dueDate >= today) continue;
      await ctx.db.patch(invoice._id, { status: "overdue", updatedAt: Date.now() });
      await logActivity(ctx, {
        workspaceId,
        invoiceId: invoice._id,
        invoiceNumber: invoice.number,
        kind: "overdue_flagged",
        actor: "system",
        title: `${invoice.number} is overdue`,
        detail: `The due date ${invoice.dueDate} has passed and the invoice is still unpaid.`,
        approvalStatus: "none",
      });
      changed += 1;
    }
  }
  return changed;
}

function isoOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
