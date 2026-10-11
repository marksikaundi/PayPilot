import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function logActivity(
  ctx: MutationCtx,
  entry: {
    workspaceId: Id<"workspaces">;
    invoiceId?: Id<"invoices">;
    invoiceNumber?: string;
    reminderId?: Id<"reminders">;
    kind:
      | "invoice_drafted"
      | "invoice_edited"
      | "invoice_approved"
      | "invoice_discarded"
      | "checkout_started"
      | "checkout_cancelled"
      | "payment_captured"
      | "payment_rejected"
      | "overdue_flagged"
      | "reminder_drafted"
      | "reminder_approved"
      | "reminder_dismissed";
    actor: "ai" | "user" | "paypal" | "system";
    title: string;
    detail: string;
    approvalStatus: "none" | "pending" | "approved" | "dismissed";
    createdAt?: number;
  },
): Promise<Id<"activity">> {
  return await ctx.db.insert("activity", {
    workspaceId: entry.workspaceId,
    kind: entry.kind,
    actor: entry.actor,
    title: entry.title,
    detail: entry.detail,
    approvalStatus: entry.approvalStatus,
    createdAt: entry.createdAt ?? Date.now(),
    ...(entry.invoiceId ? { invoiceId: entry.invoiceId } : {}),
    ...(entry.invoiceNumber ? { invoiceNumber: entry.invoiceNumber } : {}),
    ...(entry.reminderId ? { reminderId: entry.reminderId } : {}),
  });
}
