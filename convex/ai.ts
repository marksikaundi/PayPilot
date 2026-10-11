import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  clipText,
  daysUntil,
  isRecord,
  todayIso,
} from "./lib/fields";
import { centsToDecimal, dollarsToCents } from "./lib/money";
import { completeJson } from "./lib/openai";

export const draftInvoice = action({
  args: { accessKey: v.string(), prompt: v.string() },
  returns: v.id("invoices"),
  handler: async (ctx, args): Promise<Id<"invoices">> => {
    const prompt = args.prompt.trim();
    if (prompt.length < 8) {
      throw new Error("Describe the client, the work, and the price.");
    }
    if (prompt.length > 2000) {
      throw new Error("Keep the description under 2000 characters.");
    }

    const workspace = await ctx.runQuery(internal.invoices.workspaceForAgent, {
      accessKey: args.accessKey,
    });
    const dueDate = offsetDate(14);
    const drafted = await completeJson(
      `You extract one USD invoice for ${workspace.name}.
Return JSON with this shape:
{"clientName":"","clientEmail":"","dueDate":"YYYY-MM-DD","notes":"","lineItems":[{"description":"","quantity":1,"unitAmount":0}]}
unitAmount is the price of one unit in US dollars.
Today is ${todayIso()}. If the user gives no due date, use ${dueDate}.
Include clientEmail only when the user supplies one, otherwise use an empty string.
If the text is not an invoice, use an empty clientName and an empty lineItems array.
Do not mark anything paid and do not invent a PayPal link.`,
      prompt,
    );

    const parsed = parseDraft(drafted, dueDate);
    const created = await ctx.runMutation(internal.invoices.createFromAgent, {
      workspaceId: workspace.workspaceId,
      sourcePrompt: prompt,
      ...parsed,
    });
    return created.invoiceId;
  },
});

export const draftReminder = action({
  args: { accessKey: v.string(), invoiceId: v.id("invoices") },
  returns: v.id("reminders"),
  handler: async (ctx, args): Promise<Id<"reminders">> => {
    const invoice = await ctx.runQuery(internal.invoices.invoiceForAgent, {
      accessKey: args.accessKey,
      invoiceId: args.invoiceId,
    });
    assertRemindable(invoice, todayIso());
    const drafted = await completeJson(
      `You write a short payment reminder email for ${invoice.workspaceName}.
Return JSON: {"subject":"","body":""}
The invoice is ${invoice.number} for ${invoice.clientName} (${invoice.clientEmail || "no email yet"}).
Amount: $${centsToDecimal(invoice.totalCents)} USD. Due: ${invoice.dueDate}. Status: ${invoice.status}.
Notes: ${invoice.notes || "none"}.
Be polite and specific. Do not include a payment link. Do not say the invoice was paid.
The user must approve this draft before it is kept. Say nothing about sending it automatically.`,
      `Draft a reminder for ${invoice.number}.`,
    );
    const subject = clipText(drafted.subject, 140, "Subject");
    const body = clipText(drafted.body, 2000, "Reminder");
    return await ctx.runMutation(internal.activity.addReminder, {
      workspaceId: invoice.workspaceId,
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.number,
      subject,
      body,
      actor: "ai",
      title: `gpt-4o-mini drafted a reminder for ${invoice.number}`,
    });
  },
});

export const ask = action({
  args: { accessKey: v.string(), message: v.string() },
  returns: v.object({
    reply: v.string(),
    suggestionCount: v.number(),
  }),
  handler: async (ctx, args): Promise<{ reply: string; suggestionCount: number }> => {
    const message = args.message.trim();
    if (!message) throw new Error("Ask a question about the invoices in this workspace.");
    if (message.length > 2000) throw new Error("Keep the question under 2000 characters.");

    const workspace = await ctx.runQuery(internal.invoices.workspaceForAgent, {
      accessKey: args.accessKey,
    });
    const invoices = await ctx.runQuery(internal.invoices.recordsForAgent, {
      workspaceId: workspace.workspaceId,
    });
    const today = todayIso();
    const ledger = invoices
      .map(
        (invoice) =>
          `${invoice.number} | ${invoice.clientName} | ${invoice.status} | due ${invoice.dueDate} | $${centsToDecimal(invoice.totalCents)}`,
      )
      .join("\n");

    const result = await completeJson(
      `You are the payment assistant for ${workspace.name}.
You can read the invoices below and suggest reminder drafts. You cannot create a PayPal checkout, capture a payment, change a status, or send email.
Today is ${today}.
Invoices:
${ledger || "No invoices yet."}

Return JSON:
{"reply":"","suggestions":[{"type":"draft_reminder","invoiceNumber":"INV-1000","subject":"","body":""}]}
suggestions may be an empty array.
Only suggest draft_reminder for overdue invoices, or sent/approved invoices due within 3 days.
Write reminders as email the studio could copy. Do not include a payment link.
Keep reply under 120 words. Amounts are USD.`,
      message,
    );

    const reply =
      typeof result.reply === "string" && result.reply.trim()
        ? result.reply.trim().slice(0, 2000)
        : "I couldn't summarize that. Ask about a specific invoice.";
    const reminders = readSuggestions(result, invoices, today);
    const suggestionCount = await ctx.runMutation(internal.activity.saveAssistantTurn, {
      workspaceId: workspace.workspaceId,
      user: message,
      assistant: reply,
      reminders,
    });
    return { reply, suggestionCount };
  },
});

function parseDraft(raw: Record<string, unknown>, fallbackDue: string) {
  const clientName = typeof raw.clientName === "string" ? raw.clientName.trim() : "";
  const items = Array.isArray(raw.lineItems) ? raw.lineItems : [];
  if (!clientName || items.length === 0) {
    throw new Error(
      "That description didn't include a client and a price. Name the client, the work, and the amount.",
    );
  }

  const lineItems = items.slice(0, 20).map((item) => {
    if (!isRecord(item)) {
      throw new Error("The model returned a line item PayPilot couldn't read.");
    }
    const unitAmountCents = dollarsToCents(item.unitAmount);
    if (unitAmountCents === null) {
      throw new Error("The model returned a price PayPilot couldn't read. Include a dollar amount.");
    }
    const quantity =
      typeof item.quantity === "number" && Number.isFinite(item.quantity)
        ? Math.round(item.quantity)
        : 1;
    return {
      description: typeof item.description === "string" ? item.description : "",
      quantity,
      unitAmountCents,
    };
  });

  const dueDate =
    typeof raw.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate)
      ? raw.dueDate
      : fallbackDue;

  return {
    clientName,
    clientEmail: typeof raw.clientEmail === "string" ? raw.clientEmail.trim() : "",
    dueDate,
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 1000) : "",
    lineItems,
  };
}

function readSuggestions(
  raw: Record<string, unknown>,
  invoices: Array<{
    _id: import("./_generated/dataModel").Id<"invoices">;
    number: string;
    status: string;
    dueDate: string;
  }>,
  today: string,
) {
  if (!Array.isArray(raw.suggestions)) return [];
  const reminders: Array<{
    invoiceId: (typeof invoices)[number]["_id"];
    invoiceNumber: string;
    subject: string;
    body: string;
  }> = [];

  for (const suggestion of raw.suggestions.slice(0, 3)) {
    if (!isRecord(suggestion) || suggestion.type !== "draft_reminder") continue;
    if (typeof suggestion.invoiceNumber !== "string") continue;
    const invoice = invoices.find((item) => item.number === suggestion.invoiceNumber);
    if (!invoice || !canRemind(invoice, today)) continue;
    try {
      reminders.push({
        invoiceId: invoice._id,
        invoiceNumber: invoice.number,
        subject: clipText(suggestion.subject, 140, "Subject"),
        body: clipText(suggestion.body, 2000, "Reminder"),
      });
    } catch {
      continue;
    }
  }
  return reminders;
}

function canRemind(invoice: { status: string; dueDate: string }, today: string) {
  if (invoice.status === "overdue") return true;
  if (invoice.status !== "sent" && invoice.status !== "approved") return false;
  return daysUntil(today, invoice.dueDate) <= 3;
}

function assertRemindable(
  invoice: { status: string; dueDate: string; number: string },
  today: string,
) {
  if (invoice.status === "paid") throw new Error(`${invoice.number} is already paid.`);
  if (invoice.status === "void") throw new Error(`${invoice.number} was discarded.`);
  if (invoice.status === "draft") {
    throw new Error(`Approve ${invoice.number} before asking for a reminder.`);
  }
  if (!canRemind(invoice, today)) {
    throw new Error(
      `${invoice.number} is not due yet. PayPilot drafts reminders for overdue invoices and ones due within 3 days.`,
    );
  }
}

function offsetDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
