import type { Metadata } from "next";
import { DashboardScreen } from "@/components/dashboard-screen";

export const instant = false;

export const metadata: Metadata = { title: "Overview" };

export default function DashboardPage() {
  return <DashboardScreen />;
}
