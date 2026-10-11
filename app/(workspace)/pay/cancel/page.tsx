import { Suspense } from "react";
import { PayCancelScreen } from "@/components/pay-cancel-screen";

export const instant = false;

export default function PayCancelPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Returning from PayPal…</p>}>
      <PayCancelScreen />
    </Suspense>
  );
}
