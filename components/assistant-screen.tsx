"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers";
import { readableError } from "@/lib/errors";
import { cardClass, inputClass, primaryButton } from "@/lib/styles";

const PROMPTS = [
  "Which invoices are overdue?",
  "How much is still outstanding?",
  "Draft a reminder for the oldest unpaid invoice.",
];

export function AssistantScreen() {
  const { accessKey } = useWorkspace();
  const messages = useQuery(api.messages.list, accessKey ? { accessKey } : "skip");
  const ask = useAction(api.ai.ask);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send(text: string) {
    if (!accessKey || pending) return;
    const message = text.trim();
    if (!message) return;
    setPending(true);
    setError(null);
    setDraft("");
    try {
      await ask({ accessKey, message });
    } catch (reason) {
      setDraft(message);
      setError(readableError(reason));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <p className="text-sm font-medium text-pine">Assistant</p>
      <h1 className="mt-1 font-serif text-4xl tracking-tight">Ask about this workspace</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        gpt-4o-mini can see the invoices stored here. It can suggest a reminder, and that suggestion
        stays pending on the activity log until you approve it. It cannot open PayPal or mark an
        invoice paid.
      </p>
      <div className={`${cardClass} mt-6 flex min-h-[420px] flex-col`}>
        <div className="flex-1 space-y-4 p-4 sm:p-5">
          {messages === undefined ? <p className="text-sm text-muted">Loading the conversation…</p> : null}
          {messages && messages.length === 0 ? (
            <div>
              <p className="text-sm leading-6 text-muted">Try one of these.</p>
              <div className="mt-3 flex flex-col gap-2">
                {PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="rounded-2xl border border-line px-3 py-2 text-left text-sm hover:bg-paper"
                    onClick={() => void send(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages?.map((message) => (
            <div
              key={message._id}
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                message.role === "user" ? "ml-auto bg-ink text-paper" : "bg-paper text-ink"
              }`}
            >
              {message.content}
            </div>
          ))}
          {pending ? <p className="text-sm text-muted">Looking through the invoices…</p> : null}
          <div ref={endRef} />
        </div>
        <form
          className="border-t border-line p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          {error ? (
            <p className="mb-3 text-sm text-coral" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className={inputClass}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about an invoice"
              aria-label="Message"
              maxLength={2000}
            />
            <button className={primaryButton} type="submit" disabled={pending || !draft.trim()}>
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
