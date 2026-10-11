import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { logActivity } from "./lib/activityLog";
import { isoDaysFromToday } from "./lib/fields";
import { insertInvoice } from "./lib/invoiceWrite";
import { createAccessKey, findWorkspace, requireWorkspace } from "./lib/workspace";

export const current = query({
  args: { accessKey: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("workspaces"),
      name: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const workspace = await findWorkspace(ctx, args.accessKey);
    if (!workspace) return null;
    return { _id: workspace._id, name: workspace.name };
  },
});

export const integrationStatus = query({
  args: { accessKey: v.string() },
  returns: v.object({
    openai: v.boolean(),
    paypal: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireWorkspace(ctx, args.accessKey);
    return {
      openai: Boolean(process.env.OPENAI_API_KEY),
      paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
    };
  },
});

export const ensure = mutation({
  args: {},
  returns: v.object({
    workspaceId: v.id("workspaces"),
    accessKey: v.string(),
    name: v.string(),
  }),
  handler: async (ctx) => {
    const accessKey = createAccessKey();
    const name = "Northline Studio";
    const workspaceId = await ctx.db.insert("workspaces", {
      name,
      accessKey,
      nextNumber: 1042,
      createdAt: Date.now(),
    });
    return { workspaceId, accessKey, name };
  },
});

export const seedDemo = mutation({
  args: { accessKey: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const workspace = await requireWorkspace(ctx, args.accessKey);
    const existing = await ctx.db
      .query("invoices")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .take(1);
    if (existing.length > 0) {
      throw new Error("Demo invoices are already in this workspace.");
    }

    const now = Date.now();
    const day = 86_400_000;
    const dueHarbor = isoDaysFromToday(-14);

    const northwind = await insertInvoice(ctx, {
      workspaceId: workspace._id,
      number: "INV-1042",
      clientName: "Northwind Studio",
      clientEmail: "billing@northwind.example",
      notes: "Website redesign, paid in the sandbox.",
      dueDate: isoDaysFromToday(-24),
      status: "paid",
      paidOn: isoDaysFromToday(-18),
      updatedAt: now - 18 * day,
      lineItems: [
        { description: "Discovery workshop", quantity: 1, unitAmountCents: 80_000 },
        { description: "Site design and build", quantity: 1, unitAmountCents: 160_000 },
      ],
    });
    const lumen = await insertInvoice(ctx, {
      workspaceId: workspace._id,
      number: "INV-1043",
      clientName: "Lumen Cafe",
      clientEmail: "hello@lumencafe.example",
      notes: "",
      dueDate: isoDaysFromToday(-10),
      status: "paid",
      paidOn: isoDaysFromToday(-9),
      updatedAt: now - 9 * day,
      lineItems: [
        { description: "Evening photo set", quantity: 1, unitAmountCents: 68_000 },
      ],
    });
    const harbor = await insertInvoice(ctx, {
      workspaceId: workspace._id,
      number: "INV-1044",
      clientName: "Harbor & Co",
      clientEmail: "accounts@harborandco.example",
      notes: "Net 14. Follow up if it is still open.",
      dueDate: dueHarbor,
      status: "overdue",
      updatedAt: now - day,
      lineItems: [
        { description: "Packaging system", quantity: 1, unitAmountCents: 115_000 },
      ],
    });
    const ada = await insertInvoice(ctx, {
      workspaceId: workspace._id,
      number: "INV-1045",
      clientName: "Ada Okonkwo",
      clientEmail: "ada@okonkwo.example",
      notes: "Two half-day brand sessions.",
      dueDate: isoDaysFromToday(6),
      status: "sent",
      updatedAt: now - 2 * day,
      lineItems: [
        { description: "Brand workshop", quantity: 2, unitAmountCents: 45_000 },
      ],
    });
    const brightline = await insertInvoice(ctx, {
      workspaceId: workspace._id,
      number: "INV-1046",
      clientName: "Brightline Labs",
      clientEmail: "ap@brightline.example",
      notes: "Approved and ready to collect.",
      dueDate: isoDaysFromToday(12),
      status: "approved",
      updatedAt: now - 3_600_000,
      lineItems: [
        { description: "Sprint delivery", quantity: 1, unitAmountCents: 240_000 },
        { description: "QA pass", quantity: 1, unitAmountCents: 80_000 },
      ],
    });
    const maple = await insertInvoice(ctx, {
      workspaceId: workspace._id,
      number: "INV-1047",
      clientName: "Maple Goods",
      clientEmail: "hello@maplegoods.example",
      notes: "Review this draft before approving it.",
      dueDate: isoDaysFromToday(14),
      status: "draft",
      sourcePrompt:
        "Invoice Maple Goods for a half-day product photo shoot, $450, due in two weeks. Email hello@maplegoods.example.",
      updatedAt: now - 30 * 60_000,
      lineItems: [
        { description: "Product photo shoot", quantity: 1, unitAmountCents: 45_000 },
      ],
    });

    await ctx.db.patch(workspace._id, { nextNumber: 1048 });

    await ctx.db.insert("payments", {
      invoiceId: northwind,
      workspaceId: workspace._id,
      paypalOrderId: "DEMO-ORDER-1042",
      status: "captured",
      amountCents: 240_000,
      currency: "USD",
      captureId: "DEMO-CAPTURE-1042",
      payerEmail: "billing@northwind.example",
      updatedAt: now - 18 * day,
    });
    await ctx.db.insert("payments", {
      invoiceId: lumen,
      workspaceId: workspace._id,
      paypalOrderId: "DEMO-ORDER-1043",
      status: "captured",
      amountCents: 68_000,
      currency: "USD",
      captureId: "DEMO-CAPTURE-1043",
      payerEmail: "hello@lumencafe.example",
      updatedAt: now - 9 * day,
    });
    await ctx.db.insert("payments", {
      invoiceId: ada,
      workspaceId: workspace._id,
      paypalOrderId: "DEMO-ORDER-1045",
      status: "created",
      amountCents: 90_000,
      currency: "USD",
      updatedAt: now - 2 * day,
    });

    const reminderId = await ctx.db.insert("reminders", {
      workspaceId: workspace._id,
      invoiceId: harbor,
      subject: "Invoice INV-1044 is past due",
      body: `Hello Harbor & Co,\n\nInvoice INV-1044 for $1,150.00 was due on ${dueHarbor}. This sample reminder ships with the demo workspace so you can try approval before connecting gpt-4o-mini.\n\nApproving it keeps the copy. It does not send email, and it does not move money.\n\nNorthline Studio`,
      status: "draft",
      updatedAt: now - 20 * 60_000,
    });

    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: northwind,
      invoiceNumber: "INV-1042",
      kind: "payment_captured",
      actor: "paypal",
      title: "PayPal captured INV-1042",
      detail: "Demo capture for $2,400.00 from billing@northwind.example.",
      approvalStatus: "none",
      createdAt: now - 18 * day,
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: lumen,
      invoiceNumber: "INV-1043",
      kind: "payment_captured",
      actor: "paypal",
      title: "PayPal captured INV-1043",
      detail: "Demo capture for $680.00 from hello@lumencafe.example.",
      approvalStatus: "none",
      createdAt: now - 9 * day,
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: harbor,
      invoiceNumber: "INV-1044",
      kind: "overdue_flagged",
      actor: "system",
      title: "INV-1044 is overdue",
      detail: `The due date ${dueHarbor} has passed and the invoice is still unpaid.`,
      approvalStatus: "none",
      createdAt: now - day,
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: ada,
      invoiceNumber: "INV-1045",
      kind: "checkout_started",
      actor: "user",
      title: "Checkout opened for INV-1045",
      detail: "A sandbox order for $900.00 is waiting on the buyer.",
      approvalStatus: "approved",
      createdAt: now - 2 * day,
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: brightline,
      invoiceNumber: "INV-1046",
      kind: "invoice_approved",
      actor: "user",
      title: "You approved INV-1046",
      detail: "Brightline Labs can be collected with PayPal for $3,200.00.",
      approvalStatus: "approved",
      createdAt: now - 3_600_000,
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: maple,
      invoiceNumber: "INV-1047",
      kind: "invoice_drafted",
      actor: "ai",
      title: "Draft ready for Maple Goods",
      detail:
        "Sample draft loaded with the demo data. Live drafts come from gpt-4o-mini after you add an API key.",
      approvalStatus: "none",
      createdAt: now - 30 * 60_000,
    });
    await logActivity(ctx, {
      workspaceId: workspace._id,
      invoiceId: harbor,
      invoiceNumber: "INV-1044",
      reminderId,
      kind: "reminder_drafted",
      actor: "system",
      title: "Sample reminder is waiting for approval",
      detail:
        "Approving keeps the Harbor & Co reminder. It does not email anyone and it does not open PayPal.",
      approvalStatus: "pending",
      createdAt: now - 20 * 60_000,
    });

    return null;
  },
});
