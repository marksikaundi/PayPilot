import type { Metadata } from "next";
import { NewInvoiceScreen } from "@/components/new-invoice-screen";

export const instant = false;

export const metadata: Metadata = { title: "New invoice" };

export default function NewInvoicePage() {
  return <NewInvoiceScreen />;
}
