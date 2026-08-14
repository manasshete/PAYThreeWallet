import { LoadingGate } from "@/components/landing/LoadingGate";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LoadingGate>{children}</LoadingGate>;
}
