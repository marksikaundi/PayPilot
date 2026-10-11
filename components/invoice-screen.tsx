"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { RulesList } from "@/components/rules-list";
import { StatusPill } from "@/components/status-pill";
import { useWorkspace } from "@/components/providers";
import { readableError } from "@/lib/errors";
import { centsToInput, formatDate, formatMoney, formatTimestamp, parseDollars, parseQuantity } from "@/lib/format";
import { cardClass, inputClass, primaryButton, secondaryButton } from "@/lib/styles";

type LineForm = { description: string; quantity: string; unitAmount: string };
type InvoiceForm = {
  clientName: string;
  clientEmail: string;
  dueDate: string;
  notes: string;
  lineItems: LineForm[];
};

export function InvoiceScreen() {
  const params = useParams<{ id: string }>();
  const invoiceId = params.id as Id<"invoices">;
  const { accessKey } = useWorkspace();
  const detail = useQuery(
    api.invoices.get,
    accessKey ? { accessKey, invoiceId } : "skip",
  );
  const activity = useQuery(
    api.activity.listForInvoice,
    accessKey ? { accessKey, invoiceId } : "skip",
  );
  const updateDraft = useMutation(api.invoices.updateDraft);
  const approve = useMutation(api.invoices.approve);
  const discard = useMutation(api.invoices.discard);
  const resolveReminder = useMutation(api.activity.resolveReminder);
  const createCheckout = useAction(api.paypal.createCheckout);
  const draftReminder = useAction(api.ai.draftReminder);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const formStamp = detail ? `${detail.invoice._id}:${detail.invoice.updatedAt}` : null;
  const [seenStamp, setSeenStamp] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceForm | null>(null);
  if (formStamp !== seenStamp) {
    setSeenStamp(formStamp);
    setForm(detail ? toForm(detail) : null);
  }

  function updateLine(index: number, patch: Partial<LineForm>) {
    if (!form) return;
    setForm({
      ...form,
      lineItems: form.lineItems.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    });
  }

  if (detail === undefined) return <p className="text-sm text-muted">Loading invoice…</p>;
  if (detail === null) {
    return (
      <div>
        <h1 className="font-serif text-4xl">Invoice not found</h1>
        <Link href="/dashboard" className={`${secondaryButton} mt-5`}>
          Back to overview
        </Link>
      </div>
    );
  }

  const invoice = detail.invoice;
  const draft = invoice.status === "draft";
  const pendingReminder = activity?.find(
    (item) => item.approvalStatus === "pending" && item.reminderId,
  );
  const total = form ? lineTotal(form.lineItems) : invoice.totalCents;

  async function run(label: string, work: () => Promise<void>) {
    setPending(label);
    setError(null);
    try {
      await work();
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setPending(null);
    }
  }

  function parsedForm() {
    if (!form) throw new Error("The invoice form is still loading.");
    const lineItems = form.lineItems.map((line) => {
      const quantity = parseQuantity(line.quantity);
      const unitAmountCents = parseDollars(line.unitAmount);
      if (quantity === null || unitAmountCents === null) {
        throw new Error("Check the quantities and prices. Use whole quantities and amounts like 450.00.");
      }
      return { description: line.description, quantity, unitAmountCents };
    });
    return { ...form, lineItems };
  }

  async function saveDraft() {
    if (!accessKey) return;
    const parsed = parsedForm();
    await updateDraft({ accessKey, invoiceId, ...parsed });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
              All invoices
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-4xl tracking-tight">{invoice.number}</h1>
              <StatusPill status={invoice.status} />
            </div>
            <p className="mt-2 text-sm text-muted">Due {formatDate(invoice.dueDate)}</p>
          </div>
          <p className="font-serif text-4xl">{formatMoney(draft && form ? total : invoice.totalCents)}</p>
        </div>

        {invoice.sourcePrompt ? (
          <p className={`${cardClass} px-4 py-3 text-sm leading-6 text-muted`}>
            Asked for: {invoice.sourcePrompt}
          </p>
        ) : null}

        {error ? (
          <p className="rounded-2xl bg-coral-soft px-4 py-3 text-sm leading-6 text-coral" role="alert">
            {error}
          </p>
        ) : null}

        {draft && form ? (
          <form
            className={`${cardClass} space-y-4 p-5`}
            onSubmit={(event) => {
              event.preventDefault();
              void run("save", saveDraft);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client">
                <input
                  className={inputClass}
                  value={form.clientName}
                  onChange={(event) => setForm({ ...form, clientName: event.target.value })}
                />
              </Field>
              <Field label="Email">
                <input
                  className={inputClass}
                  value={form.clientEmail}
                  onChange={(event) => setForm({ ...form, clientEmail: event.target.value })}
                  placeholder="Required before approval"
                />
              </Field>
              <Field label="Due date">
                <input
                  className={inputClass}
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                />
              </Field>
              <Field label="Currency">
                <input className={inputClass} value="USD" readOnly />
              </Field>
            </div>
            <div className="space-y-3">
              {form.lineItems.map((line, index) => (
                <div key={`${invoice._id}-${index}`} className="grid gap-2 sm:grid-cols-[1fr_88px_120px_auto]">
                  <input
                    className={inputClass}
                    aria-label={`Description ${index + 1}`}
                    value={line.description}
                    onChange={(event) => updateLine(index, { description: event.target.value })}
                  />
                  <input
                    className={inputClass}
                    aria-label={`Quantity ${index + 1}`}
                    value={line.quantity}
                    onChange={(event) => updateLine(index, { quantity: event.target.value })}
                  />
                  <input
                    className={inputClass}
                    aria-label={`Price ${index + 1}`}
                    value={line.unitAmount}
                    onChange={(event) => updateLine(index, { unitAmount: event.target.value })}
                  />
                  <button
                    type="button"
                    className={secondaryButton}
                    disabled={form.lineItems.length === 1}
                    onClick={() =>
                      setForm({
                        ...form,
                        lineItems: form.lineItems.filter((_, itemIndex) => itemIndex !== index),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={secondaryButton}
                onClick={() =>
                  setForm({
                    ...form,
                    lineItems: [
                      ...form.lineItems,
                      { description: "", quantity: "1", unitAmount: "0.00" },
                    ],
                  })
                }
              >
                Add a line
              </button>
            </div>
            <Field label="Notes">
              <textarea
                className={`${inputClass} min-h-24`}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </Field>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className={secondaryButton} type="submit" disabled={pending !== null}>
                {pending === "save" ? "Saving…" : "Save draft"}
              </button>
              <button
                className={primaryButton}
                type="button"
                disabled={pending !== null}
                onClick={() =>
                  void run("approve", async () => {
                    await saveDraft();
                    if (!accessKey) return;
                    await approve({ accessKey, invoiceId });
                  })
                }
              >
                {pending === "approve" ? "Approving…" : "Approve invoice"}
              </button>
              <button
                className={secondaryButton}
                type="button"
                disabled={pending !== null}
                onClick={() =>
                  void run("discard", async () => {
                    if (!accessKey) return;
                    await discard({ accessKey, invoiceId });
                  })
                }
              >
                Discard
              </button>
            </div>
            <p className="text-sm text-muted">
              Approving locks these line items and allows a PayPal checkout for {formatMoney(total)}.
              It does not charge anyone.
            </p>
          </form>
        ) : (
          <section className={`${cardClass} p-5`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted">Client</p>
                <p className="mt-1 font-medium">{invoice.clientName}</p>
                <p className="text-sm text-muted">{invoice.clientEmail || "No email"}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Due</p>
                <p className="mt-1">{formatDate(invoice.dueDate)}</p>
              </div>
            </div>
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {detail.lineItems.map((item) => (
                <li key={item.description} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    {item.description}
                    <span className="text-muted"> × {item.quantity}</span>
                  </span>
                  <span>{formatMoney(item.quantity * item.unitAmountCents)}</span>
                </li>
              ))}
            </ul>
            {invoice.notes ? <p className="mt-4 text-sm leading-6 text-muted">{invoice.notes}</p> : null}
            {invoice.status === "approved" ? (
              <button
                className={`${secondaryButton} mt-5`}
                type="button"
                disabled={pending !== null}
                onClick={() =>
                  void run("discard", async () => {
                    if (!accessKey) return;
                    await discard({ accessKey, invoiceId });
                  })
                }
              >
                Discard
              </button>
            ) : null}
          </section>
        )}

        {invoice.status === "paid" && detail.payment ? (
          <section className="rounded-3xl border border-[#b7e0d0] bg-pine-soft p-5">
            <h2 className="font-serif text-2xl text-pine">Paid</h2>
            <p className="mt-2 text-sm leading-6 text-pine">
              PayPal capture {detail.payment.captureId ?? "recorded"} matches this invoice
              {detail.payment.payerEmail ? ` from ${detail.payment.payerEmail}` : ""}.
              {invoice.paidOn ? ` Marked paid on ${formatDate(invoice.paidOn)}.` : ""}
            </p>
          </section>
        ) : null}

        {invoice.status !== "paid" && invoice.status !== "void" && !draft ? (
          <section className={`${cardClass} p-5`}>
            <h2 className="font-serif text-2xl">Collect with PayPal</h2>
            {detail.blockers.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-coral">
                {detail.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            ) : (
              <>
                <p className="mt-2 text-sm leading-6 text-muted">
                  This opens a PayPal sandbox order for exactly {formatMoney(invoice.totalCents)}.
                  The invoice stays unpaid until the capture is verified.
                </p>
                <button
                  className={`${primaryButton} mt-4`}
                  type="button"
                  disabled={pending !== null}
                  onClick={() =>
                    void run("pay", async () => {
                      if (!accessKey) return;
                      const checkout = await createCheckout({ accessKey, invoiceId });
                      window.location.href = checkout.approveUrl;
                    })
                  }
                >
                  {pending === "pay" ? "Opening PayPal…" : `Collect ${formatMoney(invoice.totalCents)}`}
                </button>
              </>
            )}
            {detail.payment?.failureReason ? (
              <p className="mt-3 text-sm text-coral">{detail.payment.failureReason}</p>
            ) : null}
          </section>
        ) : null}

        {invoice.status === "overdue" || invoice.status === "sent" || invoice.status === "approved" ? (
          <section className={`${cardClass} p-5`}>
            <h2 className="font-serif text-2xl">Reminder</h2>
            {pendingReminder ? (
              <div className="mt-3">
                <p className="font-medium">{pendingReminder.reminderSubject}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-muted">
                  {pendingReminder.reminderBody}
                </pre>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <button
                    className={primaryButton}
                    type="button"
                    disabled={pending !== null}
                    onClick={() =>
                      void run("approve-reminder", async () => {
                        if (!accessKey) return;
                        await resolveReminder({
                          accessKey,
                          activityId: pendingReminder._id,
                          decision: "approved",
                        });
                      })
                    }
                  >
                    Approve reminder
                  </button>
                  <button
                    className={secondaryButton}
                    type="button"
                    disabled={pending !== null}
                    onClick={() =>
                      void run("dismiss-reminder", async () => {
                        if (!accessKey) return;
                        await resolveReminder({
                          accessKey,
                          activityId: pendingReminder._id,
                          decision: "dismissed",
                        });
                      })
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm leading-6 text-muted">
                  gpt-4o-mini can draft the wording. You approve it before it counts as accepted.
                  PayPilot does not email it.
                </p>
                <button
                  className={`${secondaryButton} mt-4`}
                  type="button"
                  disabled={pending !== null}
                  onClick={() =>
                    void run("remind", async () => {
                      if (!accessKey) return;
                      await draftReminder({ accessKey, invoiceId });
                    })
                  }
                >
                  {pending === "remind" ? "Drafting reminder…" : "Draft a reminder"}
                </button>
              </div>
            )}
            {detail.reminders
              .filter((reminder) => reminder.status === "approved")
              .map((reminder) => (
                <div key={reminder._id} className="mt-4 rounded-2xl bg-paper p-4">
                  <p className="text-sm font-medium">{reminder.subject}</p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-muted">
                    {reminder.body}
                  </pre>
                  <button
                    className={`${secondaryButton} mt-3`}
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `Subject: ${reminder.subject}\n\n${reminder.body}`,
                      );
                      setCopied(true);
                    }}
                  >
                    {copied ? "Copied" : "Copy reminder"}
                  </button>
                </div>
              ))}
          </section>
        ) : null}

        <section>
          <h2 className="font-serif text-2xl">On this invoice</h2>
          <ul className="mt-3 space-y-3">
            {(activity ?? []).map((item) => (
              <li key={item._id} className="rounded-2xl border border-line bg-card px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {item.title}
                    {item.approvalStatus !== "none" ? (
                      <span className="ml-2 text-xs font-normal text-muted">
                        {item.approvalStatus}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">{formatTimestamp(item.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <aside className={`${cardClass} h-fit p-5`}>
        <h2 className="font-serif text-2xl">Approval rules</h2>
        <div className="mt-4">
          <RulesList />
        </div>
      </aside>
    </div>
  );
}

function toForm(detail: {
  invoice: {
    clientName: string;
    clientEmail: string;
    dueDate: string;
    notes: string;
  };
  lineItems: Array<{ description: string; quantity: number; unitAmountCents: number }>;
}): InvoiceForm {
  return {
    clientName: detail.invoice.clientName,
    clientEmail: detail.invoice.clientEmail,
    dueDate: detail.invoice.dueDate,
    notes: detail.invoice.notes,
    lineItems: detail.lineItems.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unitAmount: centsToInput(item.unitAmountCents),
    })),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
    </label>
  );
}

function lineTotal(lines: LineForm[]) {
  return lines.reduce((sum, line) => {
    const quantity = parseQuantity(line.quantity);
    const amount = parseDollars(line.unitAmount);
    if (quantity === null || amount === null) return sum;
    return sum + quantity * amount;
  }, 0);
}
