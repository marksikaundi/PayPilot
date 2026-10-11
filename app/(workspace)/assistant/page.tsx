import type { Metadata } from "next";
import { AssistantScreen } from "@/components/assistant-screen";

export const instant = false;

export const metadata: Metadata = { title: "Assistant" };

export default function AssistantPage() {
  return <AssistantScreen />;
}
