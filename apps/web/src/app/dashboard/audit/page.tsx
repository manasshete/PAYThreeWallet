"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuditLogView } from "@pay3/shared";
import { AuditHeader } from "@/components/dashboard/AuditHeader";
import { apiFetch } from "@/lib/api";

function actionTone(action: string) {
  const a = action.toLowerCase();
  if (a.includes("reject") || a.includes("fail")) {
    return "text-rose-300/85 border-rose-400/20 bg-rose-500/[0.08]";
  }
  if (a.includes("approv")) {
    return "text-amber-300/85 border-amber-400/20 bg-amber-500/[0.08]";
  }
  if (a.includes("transfer") || a.includes("swap") || a.includes("x402")) {
    return "text-cyan-300/80 border-cyan-400/20 bg-cyan-500/[0.08]";
  }
  return "text-white/45 border-white/10 bg-white/[0.03]";
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await apiFetch<{ logs: AuditLogView[] }>("/audit");
    setLogs(data.logs);
  }, []);

  useEffect(() => {
    refresh()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      )
      .finally(() => setLoading(false));
  }, [refresh]);

  return (
    <div data-dash-reveal className="audit-page mx-auto max-w-5xl">
      <article className="overview-sheet overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#0e0e10]">
        <AuditHeader eventCount={loading ? null : logs.length} />

        <div className="px-6 py-8 md:px-10" data-overview-block>
          {error ? (
            <p className="text-sm text-red-400/90" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-white/35">
              Loading…
            </p>
          ) : logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-10 text-center">
              <p className="text-[13px] text-white/45">No audit events yet.</p>
            </div>
          ) : (
            <div className="session-list-scroll max-h-[32rem] rounded-xl border border-white/[0.07] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <ul className="divide-y divide-white/[0.06]">
                {logs.map((l) => (
                  <li
                    key={l.id}
                    className="px-4 py-3.5 transition-colors hover:bg-white/[0.02]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.1em] ${actionTone(l.action)}`}
                      >
                        {l.action}
                      </span>
                      <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tabular-nums text-white/32">
                        {new Date(l.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {l.metadata ? (
                      <pre className="mt-2 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/30 p-2.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] leading-relaxed text-white/42">
                        {JSON.stringify(l.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
