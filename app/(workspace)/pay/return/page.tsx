import { Suspense } from "react";
import { PayReturnScreen } from "@/components/pay-return-screen";

export const instant = false;

export default function PayReturnPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Confirming the PayPal capture…</p>}>
      <PayReturnScreen />
    </Suspense>
  );
}
