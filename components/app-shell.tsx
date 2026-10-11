"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers";
import { primaryButton } from "@/lib/styles";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/invoices/new", label: "New invoice" },
  { href: "/activity", label: "Activity" },
  { href: "/assistant", label: "Assistant" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const workspace = useWorkspace();
  if (!workspace.configured) return <MissingConvex />;
  return <ConnectedShell>{children}</ConnectedShell>;
}

function ConnectedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, accessKey, error, reset } = useWorkspace();
  const current = useQuery(api.workspaces.current, accessKey ? { accessKey } : "skip");
  const integrations = useQuery(
    api.workspaces.integrationStatus,
    accessKey ? { accessKey } : "skip",
  );
  const refreshOverdue = useMutation(api.invoices.refreshOverdue);
  const refreshed = useRef(false);

  useEffect(() => {
    if (!accessKey || refreshed.current) return;
    refreshed.current = true;
    void refreshOverdue({ accessKey });
  }, [accessKey, refreshOverdue]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="font-serif text-2xl tracking-tight">
            PayPilot
          </Link>
          <p className="truncate text-sm text-muted">{current?.name ?? "Sandbox workspace"}</p>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${
                  active ? "bg-ink text-paper" : "text-muted hover:bg-white hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {integrations && (!integrations.openai || !integrations.paypal) ? (
        <div className="border-b border-line bg-brass-soft">
          <p className="mx-auto w-full max-w-6xl px-4 py-3 text-sm leading-6 text-brass sm:px-6">
            {!integrations.openai
              ? "Invoice drafting and the assistant need OPENAI_API_KEY on the Convex deployment. "
              : null}
            {!integrations.paypal
              ? "Collecting a payment needs PayPal sandbox REST credentials on Convex."
              : null}
          </p>
        </div>
      ) : null}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {!ready ? <p className="text-sm text-muted">Opening your workspace…</p> : null}
        {ready && error ? (
          <div className="rounded-3xl border border-line bg-card p-6">
            <h1 className="font-serif text-3xl">The workspace didn’t open</h1>
            <p className="mt-3 text-sm leading-6 text-muted" role="alert">
              {error}
            </p>
            <button className={`${primaryButton} mt-5`} onClick={reset} type="button">
              Try again
            </button>
          </div>
        ) : null}
        {ready && !error && accessKey && current === null ? (
          <div className="rounded-3xl border border-line bg-card p-6">
            <h1 className="font-serif text-3xl">This browser’s workspace is gone</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
              The access key stored here no longer matches a workspace. Start a new sandbox
              workspace in this browser.
            </p>
            <button className={`${primaryButton} mt-5`} onClick={reset} type="button">
              Start a new workspace
            </button>
          </div>
        ) : null}
        {ready && !error && accessKey && current ? children : null}
      </main>
    </div>
  );
}

function MissingConvex() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-pine">Setup</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight">Connect Convex, then reopen this page</h1>
      <p className="mt-4 text-sm leading-6 text-muted">
        PayPilot stores invoices, approvals, and the activity log in Convex. Run{" "}
        <code className="rounded bg-white px-1.5 py-0.5">pnpm convex:dev</code> once, then{" "}
        <code className="rounded bg-white px-1.5 py-0.5">pnpm dev</code>. Convex writes{" "}
        <code className="rounded bg-white px-1.5 py-0.5">NEXT_PUBLIC_CONVEX_URL</code> into{" "}
        <code className="rounded bg-white px-1.5 py-0.5">.env.local</code>.
      </p>
    </div>
  );
}
