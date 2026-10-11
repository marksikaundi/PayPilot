"use client";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-line bg-card p-6">
      <h1 className="font-serif text-3xl">This page hit a problem</h1>
      <p className="mt-3 text-sm leading-6 text-muted" role="alert">
        {error.message || "Refresh the page and try that step again."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-full bg-pine px-4 py-2.5 text-sm font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
