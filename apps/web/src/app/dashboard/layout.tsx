import type { Metadata } from "next";
import { DashboardGate } from "@/components/dashboard/DashboardGate";

export const metadata: Metadata = {
  title: "Dashboard — Pay3",
  description: "Pay3 control plane for AI session keys, policies, and transactions.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardGate>{children}</DashboardGate>;
}
