import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-serif text-4xl">That page isn’t here</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        The invoice or route you opened doesn’t exist in this app.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-flex w-fit rounded-full bg-pine px-4 py-2.5 text-sm font-medium text-white"
      >
        Go to the workspace
      </Link>
    </div>
  );
}
