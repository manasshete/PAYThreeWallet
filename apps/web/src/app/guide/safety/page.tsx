import Link from "next/link";
import type { Metadata } from "next";
import { SAFETY_POINTS } from "@/lib/guide-content";

export const metadata: Metadata = {
  title: "Safety & limits — Pay3 Guide",
  description:
    "What Pay3 never stores, revoke, approvals, ambiguous contacts, and mainnet scope.",
};

export default function SafetyPage() {
  return (
    <article>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
        Guide
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-space-grotesk)] text-4xl font-semibold tracking-tight">
        Safety & limits
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-white/60">
        Pay3 is built so an AI can pay without getting a blank check. Read this
        before you fund a pot or share an MCP token.
      </p>

      <ul className="mt-12 space-y-10">
        {SAFETY_POINTS.map((point) => (
          <li key={point.title} className="border-l border-white/15 pl-5">
            <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-medium">
              {point.title}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-white/55">
              {point.body}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-14 flex flex-wrap gap-4 text-sm">
        <Link
          href="/guide"
          className="rounded-full border border-white/20 px-5 py-2.5 text-white/80 hover:border-white/40 hover:text-white"
        >
          Back to Guide
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full bg-white px-5 py-2.5 font-medium text-black"
        >
          Open dashboard
        </Link>
      </div>
    </article>
  );
}
