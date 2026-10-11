"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatusPill } from "@/components/status-pill";
import { useWorkspace } from "@/components/providers";
import { readableError } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { cardClass, inputClass, primaryButton, secondaryButton } from "@/lib/styles";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "approved", label: "Approved" },
  { id: "sent", label: "Awaiting" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "void", label: "Discarded" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export function DashboardScreen() {
  const { accessKey } = useWorkspace();
  const [month] = useState(() => new Date().toISOString().slice(0, 7));
  const [filter, setFilter] = useState<FilterId>("all");
  const [search, setSearch] = useState("");
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const seedDemo = useMutation(api.workspaces.seedDemo);

  const summary = useQuery(
    api.invoices.summary,
    accessKey && month ? { accessKey, month } : "skip",
  );
  const invoices = useQuery(
    api.invoices.list,
    accessKey
      ? {
          accessKey,
          search,
          ...(filter === "all" ? {} : { status: filter }),
        }
      : "skip",
  );

  async function loadDemo() {
    if (!accessKey) return;
    setSeeding(true);
    setSeedError(null);
    try {
      await seedDemo({ accessKey });
    } catch (error) {
      setSeedError(readableError(error));
    } finally {
      setSeeding(false);
    }
  }

  const maxPaid = Math.max(...(summary?.months.map((item) => item.paidCents) ?? [0]), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-pine">Overview</p>
          <h1 className="mt-1 font-serif text-4xl tracking-tight">Invoices</h1>
        </div>
        <Link href="/invoices/new" className={primaryButton}>
          New invoice
        </Link>
      </div>

      {summary === undefined ? (
        <p className="text-sm text-muted">Loading the workspace…</p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Outstanding" value={formatMoney(summary.outstandingCents)} detail={`${summary.awaitingCount} open`} />
            <Stat label="Overdue" value={formatMoney(summary.overdueCents)} detail={`${summary.overdueCount} invoices`} tone="coral" />
            <Stat label="Collected" value={formatMoney(summary.paidCents)} detail={`${summary.paidCount} paid`} tone="pine" />
            <Stat label="Drafts" value={String(summary.draftCount)} detail="Waiting for review" />
          </section>

          <section className={`${cardClass} p-5`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-2xl">Collected by month</h2>
              <p className="text-xs text-muted">Paid invoices only</p>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-3">
              {summary.months.map((item) => (
                <div key={item.key} className="flex flex-col justify-end">
                  <div className="flex h-28 items-end rounded-xl bg-paper px-2">
                    <div
                      className="w-full rounded-t-lg bg-pine"
                      style={{ height: `${Math.max((item.paidCents / maxPaid) * 100, item.paidCents > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm">{item.label}</p>
                  <p className="text-xs text-muted">{formatMoney(item.paidCents)}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                  filter === item.id ? "bg-ink text-paper" : "border border-line bg-card text-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <input
            className={`${inputClass} sm:max-w-xs`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search client, email, or number"
            aria-label="Search invoices"
          />
        </div>

        {invoices === undefined ? <p className="text-sm text-muted">Loading invoices…</p> : null}
        {invoices && invoices.length === 0 && summary?.invoiceCount === 0 ? (
          <div className={`${cardClass} p-6`}>
            <h2 className="font-serif text-3xl">Start with a sentence, or load the demo</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
              This workspace is empty. Describe an invoice and gpt-4o-mini will draft it, or load
              sample invoices so you can try approval, reminders, and PayPal checkout.
            </p>
            {seedError ? (
              <p className="mt-3 text-sm text-coral" role="alert">
                {seedError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button className={primaryButton} type="button" onClick={loadDemo} disabled={seeding}>
                {seeding ? "Loading demo…" : "Load demo invoices"}
              </button>
              <Link href="/invoices/new" className={secondaryButton}>
                Describe an invoice
              </Link>
            </div>
          </div>
        ) : null}
        {invoices && invoices.length === 0 && (summary?.invoiceCount ?? 0) > 0 ? (
          <p className="text-sm text-muted">No invoices match that search.</p>
        ) : null}
        {invoices && invoices.length > 0 ? (
          <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-card">
            {invoices.map((invoice) => (
              <li key={invoice._id}>
                <Link
                  href={`/invoices/${invoice._id}`}
                  className="flex flex-col gap-3 px-4 py-4 transition hover:bg-paper sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted">{invoice.number}</span>
                      <StatusPill status={invoice.status} />
                    </div>
                    <p className="mt-1 font-medium">{invoice.clientName}</p>
                    <p className="text-sm text-muted">Due {formatDate(invoice.dueDate)}</p>
                  </div>
                  <p className="font-serif text-2xl">{formatMoney(invoice.totalCents)}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  tone = "ink",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "ink" | "pine" | "coral";
}) {
  const color = tone === "pine" ? "text-pine" : tone === "coral" ? "text-coral" : "text-ink";
  return (
    <div className={`${cardClass} p-4`}>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-2 font-serif text-3xl tracking-tight ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}
