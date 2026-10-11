"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers";
import { readableError } from "@/lib/errors";
import { formatTimestamp } from "@/lib/format";
import { primaryButton, secondaryButton } from "@/lib/styles";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Needs approval" },
  { id: "payments", label: "Payments" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const PAYMENT_KINDS = new Set([
  "checkout_started",
  "checkout_cancelled",
  "payment_captured",
  "payment_rejected",
]);

const ACTOR_LABEL = {
  ai: "AI",
  user: "You",
  paypal: "PayPal",
  system: "System",
};

export function ActivityScreen() {
  const { accessKey } = useWorkspace();
  const activity = useQuery(api.activity.list, accessKey ? { accessKey } : "skip");
  const resolveReminder = useMutation(api.activity.resolveReminder);
  const [filter, setFilter] = useState<FilterId>("all");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const visible = (activity ?? []).filter((item) => {
    if (filter === "pending") return item.approvalStatus === "pending";
    if (filter === "payments") return PAYMENT_KINDS.has(item.kind);
    return true;
  });

  async function resolve(activityId: (typeof visible)[number]["_id"], decision: "approved" | "dismissed") {
    if (!accessKey) return;
    setPendingId(activityId);
    setError(null);
    try {
      await resolveReminder({ accessKey, activityId, decision });
    } catch (reason) {
      setError(readableError(reason));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-pine">Activity</p>
      <h1 className="mt-1 font-serif text-4xl tracking-tight">What was suggested, and what you approved</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        The model can draft invoices and reminders. PayPal events show up after a checkout. Pending
        items stay pending until you accept or dismiss them.
      </p>
      <div className="mt-5 flex gap-2 overflow-x-auto">
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
      {error ? (
        <p className="mt-4 text-sm text-coral" role="alert">
          {error}
        </p>
      ) : null}
      {activity === undefined ? <p className="mt-6 text-sm text-muted">Loading activity…</p> : null}
      {activity && visible.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nothing in this view yet.</p>
      ) : null}
      <ol className="mt-6 space-y-3">
        {visible.map((item) => (
          <li key={item._id} className="rounded-3xl border border-line bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full bg-paper px-2 py-1">{ACTOR_LABEL[item.actor]}</span>
              <span>{formatTimestamp(item.createdAt)}</span>
              {item.approvalStatus === "pending" ? (
                <span className="rounded-full bg-brass-soft px-2 py-1 text-brass">Needs approval</span>
              ) : null}
              {item.approvalStatus === "approved" ? (
                <span className="rounded-full bg-pine-soft px-2 py-1 text-pine">Approved</span>
              ) : null}
              {item.approvalStatus === "dismissed" ? (
                <span className="rounded-full bg-paper px-2 py-1">Dismissed</span>
              ) : null}
            </div>
            <h2 className="mt-3 font-serif text-2xl">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{item.detail}</p>
            {item.reminderSubject ? (
              <div className="mt-3 rounded-2xl bg-paper p-4">
                <p className="text-sm font-medium">{item.reminderSubject}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-muted">
                  {item.reminderBody}
                </pre>
              </div>
            ) : null}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              {item.invoiceId ? (
                <Link href={`/invoices/${item.invoiceId}`} className={secondaryButton}>
                  Open {item.invoiceNumber ?? "invoice"}
                </Link>
              ) : null}
              {item.approvalStatus === "pending" ? (
                <>
                  <button
                    className={primaryButton}
                    type="button"
                    disabled={pendingId === item._id}
                    onClick={() => void resolve(item._id, "approved")}
                  >
                    Approve
                  </button>
                  <button
                    className={secondaryButton}
                    type="button"
                    disabled={pendingId === item._id}
                    onClick={() => void resolve(item._id, "dismissed")}
                  >
                    Dismiss
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
