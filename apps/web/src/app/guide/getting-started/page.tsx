import Link from "next/link";
import type { Metadata } from "next";
import { GETTING_STARTED_STEPS } from "@/lib/guide-content";

export const metadata: Metadata = {
  title: "Getting started — Pay3 Guide",
  description:
    "Connect Freighter, fund your allocation pot, add contacts, and create an AI session.",
};

export default function GettingStartedPage() {
  return (
    <article>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
        Guide
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-space-grotesk)] text-4xl font-semibold tracking-tight">
        Getting started
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-white/60">
        About ten minutes on Stellar mainnet. You need the{" "}
        <a
          href="https://www.freighter.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white underline underline-offset-4"
        >
          Freighter
        </a>{" "}
        browser extension set to <strong className="font-medium text-white/80">mainnet</strong>.
        Only fund the allocation pot with XLM you accept spending.
      </p>

      <ol className="mt-12 space-y-10">
        {GETTING_STARTED_STEPS.map((step, i) => (
          <li key={step.title} className="border-l border-white/15 pl-5">
            <span className="font-[family-name:var(--font-jetbrains-mono)] text-xs text-white/35">
              Step {i + 1}
            </span>
            <h2 className="mt-1 font-[family-name:var(--font-space-grotesk)] text-xl font-medium">
              {step.title}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-white/55">
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-14 flex flex-wrap gap-4 text-sm">
        <Link
          href="/dashboard"
          className="rounded-full bg-white px-5 py-2.5 font-medium text-black"
        >
          Open dashboard
        </Link>
        <Link
          href="/guide/cursor-mcp"
          className="rounded-full border border-white/20 px-5 py-2.5 text-white/80 hover:border-white/40 hover:text-white"
        >
          Next: Cursor MCP
        </Link>
      </div>
    </article>
  );
}
