"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useWorkspace } from "@/components/providers";
import { readableError } from "@/lib/errors";
import { cardClass, primaryButton } from "@/lib/styles";

export function PayCancelScreen() {
  const params = useSearchParams();
  const invoiceId = params.get("invoice");
  const { accessKey, ready } = useWorkspace();
  const cancelCheckout = useMutation(api.invoices.cancelCheckout);
  const started = useRef(false);
  const [message, setMessage] = useState("The buyer left PayPal before paying. The invoice is still open.");

  useEffect(() => {
    if (!ready || !accessKey || !invoiceId || started.current) return;
    started.current = true;
    void cancelCheckout({ accessKey, invoiceId: invoiceId as Id<"invoices"> }).catch(
      (error: unknown) => {
        setMessage(readableError(error));
      },
    );
  }, [accessKey, cancelCheckout, invoiceId, ready]);

  return (
    <div className={`${cardClass} mx-auto max-w-xl p-6`}>
      <p className="text-sm font-medium text-pine">PayPal sandbox</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">Checkout cancelled</h1>
      <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
      {invoiceId ? (
        <Link href={`/invoices/${invoiceId}`} className={`${primaryButton} mt-5`}>
          Return to the invoice
        </Link>
      ) : (
        <Link href="/dashboard" className={`${primaryButton} mt-5`}>
          Back to overview
        </Link>
      )}
    </div>
  );
}
