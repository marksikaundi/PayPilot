import { Suspense } from "react";
import { InvoiceScreen } from "@/components/invoice-screen";

export const instant = false;

export default function InvoicePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading invoice…</p>}>
      <InvoiceScreen />
    </Suspense>
  );
}
