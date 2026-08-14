import Link from "next/link";
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/lib/guide-content";

export const metadata: Metadata = {
  title: "Guide — Pay3",
  description:
    "How to use Pay3 on Stellar mainnet: Freighter, allocation pot, sessions, and Cursor MCP.",
};

export default function GuideIndexPage() {
  return (
    <article>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
        Mainnet
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-space-grotesk)] text-4xl font-semibold tracking-tight md:text-5xl">
        How to use Pay3
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-white/60">
        Give an AI a separate spending pot on Stellar — with limits you set,
        Freighter authorization, and a kill switch. Follow these guides in
        order for your first payment.
      </p>

      <ul className="mt-12 space-y-4">
        {GUIDE_PAGES.map((page, i) => (
          <li key={page.href}>
            <Link
              href={page.href}
              className="block rounded-xl border border-white/10 bg-white/[0.03] px-5 py-5 transition hover:border-white/25 hover:bg-white/[0.05]"
            >
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-white/35">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mt-1 font-[family-name:var(--font-space-grotesk)] text-xl font-medium text-white">
                {page.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {page.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-12 text-sm text-white/45">
        Ready?{" "}
        <Link href="/dashboard" className="text-white underline underline-offset-4">
          Open the dashboard
        </Link>
      </p>
    </article>
  );
}
