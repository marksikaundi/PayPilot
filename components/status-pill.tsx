import { STATUS_LABEL } from "@/lib/format";

const STYLES: Record<string, string> = {
  draft: "border-line bg-paper text-muted",
  approved: "border-[#ead7a8] bg-brass-soft text-brass",
  sent: "border-[#ead7a8] bg-brass-soft text-brass",
  overdue: "border-[#f3c7bf] bg-coral-soft text-coral",
  paid: "border-[#b7e0d0] bg-pine-soft text-pine",
  void: "border-line bg-paper text-muted",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STYLES[status] ?? STYLES.draft}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
