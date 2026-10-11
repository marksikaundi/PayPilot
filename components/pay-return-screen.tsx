"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers";
import { readableError } from "@/lib/errors";
import { cardClass, primaryButton } from "@/lib/styles";

export function PayReturnScreen() {
  const params = useSearchParams();
  const token = params.get("token");
  const { accessKey, ready } = useWorkspace();
  const captureOrder = useAction(api.paypal.captureOrder);
  const started = useRef(false);
  const [state, setState] = useState<"working" | "paid" | "error">("working");
  const [detail, setDetail] = useState("Confirming the PayPal capture…");
  const [invoiceId, setInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !accessKey || !token || started.current) return;
    started.current = true;
    void captureOrder({ accessKey, paypalOrderId: token })
      .then((result) => {
        setInvoiceId(result.invoiceId);
        setState("paid");
        setDetail(
          result.alreadyPaid
            ? `${result.number} was already marked paid.`
            : `${result.number} is paid. The captured amount matched the invoice.`,
        );
      })
      .catch((error: unknown) => {
        setState("error");
        setDetail(readableError(error));
      });
  }, [accessKey, captureOrder, ready, token]);

  return (
    <div className={`${cardClass} mx-auto max-w-xl p-6`}>
      <p className="text-sm font-medium text-pine">PayPal sandbox</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">
        {state === "paid" ? "Payment captured" : state === "error" ? "Payment not completed" : "Checking the capture"}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted" role="status">
        {!token
          ? "PayPal did not return an order id. Open the invoice and start checkout again."
          : detail}
      </p>
      {invoiceId ? (
        <Link href={`/invoices/${invoiceId}`} className={`${primaryButton} mt-5`}>
          View the invoice
        </Link>
      ) : (
        <Link href="/dashboard" className={`${primaryButton} mt-5`}>
          Back to overview
        </Link>
      )}
    </div>
  );
}
