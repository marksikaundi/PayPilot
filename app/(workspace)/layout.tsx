import { AppShell } from "@/components/app-shell";

export const instant = false;

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
