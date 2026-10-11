import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  assertLineItems,
  checkoutBlockers,
  totalCents,
  type InvoiceStatus,
  type LineInput,
} from "./fields";

export function toInvoiceDto(invoice: Doc<"invoices">) {
  return {
    _id: invoice._id,
    number: invoice.number,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    currency: invoice.currency,
    notes: invoice.notes,
    dueDate: invoice.dueDate,
    status: invoice.status,
    sourcePrompt: invoice.sourcePrompt ?? null,
    totalCents: invoice.totalCents,
    paidOn: invoice.paidOn ?? null,
    updatedAt: invoice.updatedAt,
  };
}

export async function loadLineItems(
  ctx: QueryCtx | MutationCtx,
  invoiceId: Id<"invoices">,
): Promise<LineInput[]> {
  const rows = await ctx.db
    .query("lineItems")
    .withIndex("by_invoice", (q) => q.eq("invoiceId", invoiceId))
    .take(30);
  return rows
    .sort((left, right) => left.position - right.position)
    .map((row) => ({
      description: row.description,
      quantity: row.quantity,
      unitAmountCents: row.unitAmountCents,
    }));
}

export async function insertInvoice(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    number: string;
    clientName: string;
    clientEmail: string;
    notes: string;
    dueDate: string;
    status: InvoiceStatus;
    sourcePrompt?: string;
    lineItems: LineInput[];
    paidOn?: string;
    updatedAt?: number;
  },
): Promise<Id<"invoices">> {
  const mode = args.status === "draft" ? "draft" : "approve";
  const lineItems = assertLineItems(args.lineItems, mode);
  const invoiceId = await ctx.db.insert("invoices", {
    workspaceId: args.workspaceId,
    number: args.number,
    clientName: args.clientName,
    clientEmail: args.clientEmail,
    currency: "USD",
    notes: args.notes,
    dueDate: args.dueDate,
    status: args.status,
    totalCents: totalCents(lineItems),
    updatedAt: args.updatedAt ?? Date.now(),
    ...(args.sourcePrompt ? { sourcePrompt: args.sourcePrompt } : {}),
    ...(args.paidOn ? { paidOn: args.paidOn } : {}),
  });
  await writeLineItems(ctx, args.workspaceId, invoiceId, lineItems);
  return invoiceId;
}

export async function replaceLineItems(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  invoiceId: Id<"invoices">,
  lineItems: LineInput[],
): Promise<number> {
  const existing = await ctx.db
    .query("lineItems")
    .withIndex("by_invoice", (q) => q.eq("invoiceId", invoiceId))
    .take(30);
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }
  await writeLineItems(ctx, workspaceId, invoiceId, lineItems);
  return totalCents(lineItems);
}

async function writeLineItems(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  invoiceId: Id<"invoices">,
  lineItems: LineInput[],
) {
  for (const [position, item] of lineItems.entries()) {
    await ctx.db.insert("lineItems", {
      invoiceId,
      workspaceId,
      description: item.description,
      quantity: item.quantity,
      unitAmountCents: item.unitAmountCents,
      position,
    });
  }
}

export async function nextInvoiceNumber(
  ctx: MutationCtx,
  workspace: Doc<"workspaces">,
): Promise<string> {
  const number = `INV-${workspace.nextNumber}`;
  await ctx.db.patch(workspace._id, { nextNumber: workspace.nextNumber + 1 });
  return number;
}

export function assertPayable(invoice: Doc<"invoices">) {
  const blockers = checkoutBlockers(invoice);
  if (blockers.length > 0) throw new Error(blockers[0]);
  if (
    invoice.status !== "approved" &&
    invoice.status !== "sent" &&
    invoice.status !== "overdue"
  ) {
    throw new Error("Approve the invoice before opening PayPal.");
  }
}

export async function ownedInvoice(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<"workspaces">,
  invoiceId: Id<"invoices">,
): Promise<Doc<"invoices">> {
  const invoice = await ctx.db.get(invoiceId);
  if (!invoice || invoice.workspaceId !== workspaceId) {
    throw new Error("Invoice not found");
  }
  return invoice;
}
