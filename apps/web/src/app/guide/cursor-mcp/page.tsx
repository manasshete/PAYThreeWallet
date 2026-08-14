import Link from "next/link";
import type { Metadata } from "next";
import {
  CURSOR_MCP_STEPS,
  MCP_EXAMPLE_PROMPTS,
  MCP_JSON_EXAMPLE,
  MCP_LOCAL_JSON_EXAMPLE,
} from "@/lib/guide-content";

export const metadata: Metadata = {
  title: "Cursor MCP setup — Pay3 Guide",
  description:
    "Configure Pay3 in Cursor with the hosted MCP URL and your session token.",
};

export default function CursorMcpPage() {
  return (
    <article>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
        Guide
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-space-grotesk)] text-4xl font-semibold tracking-tight">
        Cursor MCP setup
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-white/60">
        Paste the hosted MCP URL and your session token into Cursor. No repo
        clone required for production. Local stdio MCP remains available for
        developers.
      </p>

      <ol className="mt-12 space-y-10">
        {CURSOR_MCP_STEPS.map((step, i) => (
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

      <h2 className="mt-14 font-[family-name:var(--font-space-grotesk)] text-xl font-medium">
        Hosted mcp.json (recommended)
      </h2>
      <p className="mt-2 text-sm text-white/50">
        File: <code className="text-white/80">.cursor/mcp.json</code> (gitignored).
        Token must come from a session created against{" "}
        <code className="text-white/80">https://pay3-api.vercel.app</code>.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04] p-4 font-[family-name:var(--font-jetbrains-mono)] text-xs leading-relaxed text-white/80">
        {MCP_JSON_EXAMPLE}
      </pre>

      <h2 className="mt-14 font-[family-name:var(--font-space-grotesk)] text-xl font-medium">
        Local stdio (developers)
      </h2>
      <p className="mt-2 text-sm text-white/50">
        For local API work:{" "}
        <code className="text-white/80">npm run build:mcp</code> then{" "}
        <code className="text-white/80">npm run dev:api</code>.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04] p-4 font-[family-name:var(--font-jetbrains-mono)] text-xs leading-relaxed text-white/80">
        {MCP_LOCAL_JSON_EXAMPLE}
      </pre>

      <h2 className="mt-14 font-[family-name:var(--font-space-grotesk)] text-xl font-medium">
        Example prompts
      </h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] text-white/55">
        {MCP_EXAMPLE_PROMPTS.map((p) => (
          <li key={p}>
            <span className="text-white/80">&ldquo;{p}&rdquo;</span>
          </li>
        ))}
      </ul>

      <h2 className="mt-14 font-[family-name:var(--font-space-grotesk)] text-xl font-medium">
        Lost your token?
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-white/55">
        Create a new session in the dashboard and copy the new token. Old tokens
        cannot be recovered — only a hash is stored.
      </p>

      <div className="mt-14 flex flex-wrap gap-4 text-sm">
        <Link
          href="/dashboard/sessions"
          className="rounded-full bg-white px-5 py-2.5 font-medium text-black"
        >
          Create a session
        </Link>
        <Link
          href="/guide/safety"
          className="rounded-full border border-white/20 px-5 py-2.5 text-white/80 hover:border-white/40 hover:text-white"
        >
          Next: Safety
        </Link>
      </div>
    </article>
  );
}
