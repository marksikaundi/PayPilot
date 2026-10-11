import Link from "next/link";
import { APPROVAL_RULES } from "@/components/rules-list";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <p className="font-serif text-2xl tracking-tight">PayPilot</p>
        <Link
          href="/dashboard"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper"
        >
          Open workspace
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-8 sm:px-6 sm:py-14">
        <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-medium text-pine">Invoice agent · PayPal sandbox</p>
            <h1 className="mt-4 max-w-xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
              Describe the work. Approve the invoice. Collect with PayPal.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
              PayPilot drafts a bill from a sentence, waits for you to check it, then opens a
              PayPal checkout for that exact total. The model never moves the money.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex justify-center rounded-full bg-pine px-5 py-3 text-sm font-medium text-white"
              >
                Open the workspace
              </Link>
              <a
                href="#rules"
                className="inline-flex justify-center rounded-full border border-line bg-card px-5 py-3 text-sm font-medium"
              >
                Read the approval rules
              </a>
            </div>
          </div>
          <div className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_20px_60px_rgba(28,25,21,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted">INV-1044</p>
                <p className="mt-2 font-serif text-3xl">Harbor & Co</p>
              </div>
              <span className="rounded-full bg-coral-soft px-2.5 py-1 text-xs font-medium text-coral">
                Overdue
              </span>
            </div>
            <div className="mt-6 space-y-3 border-y border-line py-4 text-sm">
              <div className="flex justify-between gap-4">
                <span>Packaging system</span>
                <span>$1,150.00</span>
              </div>
              <div className="flex justify-between gap-4 font-medium">
                <span>Total due</span>
                <span>$1,150.00</span>
              </div>
            </div>
            <ol className="mt-5 space-y-3 text-sm">
              <li className="flex justify-between gap-4">
                <span>System flagged it overdue</span>
                <span className="text-muted">Done</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Reminder waiting for you</span>
                <span className="text-brass">Pending</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>PayPal checkout</span>
                <span className="text-muted">After approval</span>
              </li>
            </ol>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Say who the invoice is for",
              body: "gpt-4o-mini extracts the client, line items, and due date. You can also start from a blank invoice.",
            },
            {
              step: "02",
              title: "Review it, then approve",
              body: "Edit the draft. Approval locks the total and is the only way checkout becomes available.",
            },
            {
              step: "03",
              title: "Capture a sandbox payment",
              body: "PayPal’s Orders API creates the order. The invoice turns paid only when the capture matches.",
            },
          ].map((item) => (
            <article key={item.step} className="rounded-3xl border border-line bg-card p-5">
              <p className="font-mono text-xs text-muted">{item.step}</p>
              <h2 className="mt-3 font-serif text-2xl">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{item.body}</p>
            </article>
          ))}
        </section>

        <section id="rules" className="grid gap-8 rounded-[2rem] border border-line bg-card p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-pine">Approval rules</p>
            <h2 className="mt-2 font-serif text-4xl tracking-tight">Nothing is collected by accident</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              These rules are enforced on the server. The assistant can suggest. You decide.
            </p>
          </div>
          <ol className="space-y-4">
            {APPROVAL_RULES.map((rule) => (
              <li key={rule.title}>
                <p className="font-medium">{rule.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{rule.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-3 border-t border-line pt-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Next.js · Convex · PayPal Orders API · gpt-4o-mini</p>
          <p>Sandbox only. No live payments.</p>
        </section>
      </main>
    </div>
  );
}
