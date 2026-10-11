"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers";
import { readableError } from "@/lib/errors";
import { cardClass, inputClass, primaryButton, secondaryButton } from "@/lib/styles";

const EXAMPLES = [
  {
    label: "Harbor & Co, $1,150",
    prompt:
      "Invoice Harbor & Co for a packaging system, $1,150, due in 14 days. Email accounts@harborandco.example.",
  },
  {
    label: "Lumen Cafe, $680",
    prompt:
      "Bill Lumen Cafe $680 for an evening photo set, due next Friday, hello@lumencafe.example.",
  },
];

export function NewInvoiceScreen() {
  const router = useRouter();
  const { accessKey } = useWorkspace();
  const draftInvoice = useAction(api.ai.draftInvoice);
  const createBlank = useMutation(api.invoices.createBlank);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"ai" | "blank" | null>(null);

  async function onDraft() {
    if (!accessKey) return;
    setPending("ai");
    setError(null);
    try {
      const invoiceId = await draftInvoice({ accessKey, prompt });
      router.push(`/invoices/${invoiceId}`);
    } catch (reason) {
      setError(readableError(reason));
      setPending(null);
    }
  }

  async function onBlank() {
    if (!accessKey) return;
    setPending("blank");
    setError(null);
    try {
      const invoiceId = await createBlank({ accessKey });
      router.push(`/invoices/${invoiceId}`);
    } catch (reason) {
      setError(readableError(reason));
      setPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-medium text-pine">New invoice</p>
      <h1 className="mt-1 font-serif text-4xl tracking-tight">Describe who owes you</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        gpt-4o-mini turns the sentence into a draft. You review every line before anything can be
        collected. PayPilot will not open PayPal from this step.
      </p>
      <form
        className={`${cardClass} mt-6 p-5`}
        onSubmit={(event) => {
          event.preventDefault();
          void onDraft();
        }}
      >
        <label className="block">
          <span className="mb-2 block text-sm text-muted">Invoice description</span>
          <textarea
            className={`${inputClass} min-h-36 resize-y`}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Client, work, price, due date, and email if you have it."
            maxLength={2000}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              className="rounded-full border border-line px-3 py-1.5 text-left text-xs text-muted hover:bg-paper"
              onClick={() => setPrompt(example.prompt)}
            >
              {example.label}
            </button>
          ))}
        </div>
        {error ? (
          <p className="mt-4 text-sm leading-6 text-coral" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button className={primaryButton} type="submit" disabled={pending !== null}>
            {pending === "ai" ? "Drafting…" : "Draft with AI"}
          </button>
          <button className={secondaryButton} type="button" onClick={onBlank} disabled={pending !== null}>
            {pending === "blank" ? "Creating…" : "Start from a blank invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
