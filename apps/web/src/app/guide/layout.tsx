import Link from "next/link";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/SecuritySection";

export default function GuideLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main" className="min-h-screen bg-black pt-28 pb-16 text-white">
        <div className="guide-rise mx-auto max-w-3xl px-6 md:px-12">
          <p className="mb-8 text-sm text-white/45">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <span className="mx-2 text-white/25">/</span>
            <Link href="/guide" className="hover:text-white">
              Guide
            </Link>
          </p>
          <div className="guide-rise-stagger">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
