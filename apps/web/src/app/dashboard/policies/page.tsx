"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionView } from "@pay3/shared";
import { PoliciesHeader } from "@/components/dashboard/PoliciesHeader";
import { apiFetch } from "@/lib/api";

type EvalResult = {
  decision: "AUTO_EXECUTE" | "PENDING_APPROVAL" | "REJECTED";
  reason: string;
  checks: string[];
  spentToday: string;
  clientType: string;
};

const POLICY_ACTIONS = [
  { value: "get_balance", label: "get_balance", financial: false },
  { value: "get_transaction_history", label: "get_transaction_history", financial: false },
  { value: "get_swap_quote", label: "get_swap_quote", financial: false },
  { value: "transfer", label: "transfer", financial: true },
  { value: "execute_swap", label: "execute_swap", financial: true },
  { value: "x402_fetch", label: "x402_fetch", financial: true },
] as const;

function decisionTone(decision: EvalResult["decision"] | null) {
  if (decision === "AUTO_EXECUTE") {
    return "text-emerald-300/90 border-emerald-400/20 bg-emerald-500/[0.08]";
  }
  if (decision === "PENDING_APPROVAL") {
    return "text-amber-300/90 border-amber-400/20 bg-amber-500/[0.08]";
  }
  if (decision === "REJECTED") {
    return "text-rose-300/85 border-rose-400/20 bg-rose-500/[0.08]";
  }
  return "text-white/40 border-white/10 bg-white/[0.03]";
}

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[14px] text-white outline-none focus:border-white/25";

export default function PoliciesPage() {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [action, setAction] = useState("transfer");
  const [asset, setAsset] = useState("XLM");
  const [amount, setAmount] = useState("10");
  const [recipient, setRecipient] = useState("Alex");
  const [result, setResult] = useState<EvalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const selected = POLICY_ACTIONS.find((a) => a.value === action);
  const needsFinancial = selected?.financial ?? false;

  const loadSessions = useCallback(async () => {
    const data = await apiFetch<{ sessions: SessionView[] }>("/sessions");
    const active = data.sessions.filter((s) => s.active);
    setSessions(active);
    setSessionId((prev) => prev || active[0]?.id || "");
  }, []);

  useEffect(() => {
    loadSessions()
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load sessions")
      )
      .finally(() => setLoading(false));
  }, [loadSessions]);

  async function evaluate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiFetch<EvalResult>("/policy/evaluate", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          action,
          asset: needsFinancial ? asset : undefined,
          amount: needsFinancial ? amount : undefined,
          recipient: needsFinancial ? recipient : undefined,
        }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-dash-reveal className="policies-page mx-auto max-w-5xl">
      <article className="overview-sheet overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#0e0e10]">
        <PoliciesHeader
          sessionCount={loading ? null : sessions.length}
          lastDecision={result?.decision ?? null}
        />

        <div className="px-6 py-8 md:px-10">
          {sessions.length === 0 && !loading ? (
            <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-10 text-center">
              <p className="text-[13px] text-white/45">
                No active sessions. Create one under Sessions first.
              </p>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-2">
              <form onSubmit={evaluate} className="space-y-4" data-overview-block>
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.16em] text-white/38">
                  Simulate request
                </p>

                <label className="block text-sm">
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.12em] text-white/35">
                    Session
                  </span>
                  <select
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    className={fieldClass}
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label ?? s.clientType} ({s.clientType})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.12em] text-white/35">
                    MCP action
                  </span>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className={fieldClass}
                  >
                    {POLICY_ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>

                {needsFinancial ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className="block text-sm sm:col-span-1">
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.12em] text-white/35">
                        Asset
                      </span>
                      <input
                        value={asset}
                        onChange={(e) => setAsset(e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                    <label className="block text-sm sm:col-span-1">
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.12em] text-white/35">
                        Amount
                      </span>
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={fieldClass}
                      />
                    </label>
                    <label className="block text-sm sm:col-span-1">
                      <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.12em] text-white/35">
                        {action === "execute_swap" ? "Asset out" : "Recipient"}
                      </span>
                      <input
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder={action === "x402_fetch" ? "G… payTo" : "Alex or G…"}
                        className={fieldClass}
                      />
                    </label>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={busy || !sessionId || loading}
                  className="btn-primary disabled:opacity-50"
                >
                  {busy ? "Evaluating…" : "Evaluate policy"}
                </button>
              </form>

              <div className="space-y-4" data-overview-block>
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.16em] text-white/38">
                  Result
                </p>

                {error ? (
                  <p className="text-sm text-red-400/90" role="alert">
                    {error}
                  </p>
                ) : null}

                {!result && !error ? (
                  <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-10 text-center">
                    <p className="text-[13px] text-white/45">
                      Run a simulation to see AUTO_EXECUTE, PENDING_APPROVAL, or
                      REJECTED.
                    </p>
                  </div>
                ) : null}

                {result ? (
                  <div className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.12em] ${decisionTone(result.decision)}`}
                    >
                      {result.decision}
                    </span>
                    <p className="text-[14px] leading-relaxed text-white/70">
                      {result.reason}
                    </p>
                    <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-white/35">
                      Spent today: {result.spentToday} · {result.clientType}
                    </p>
                    <ul className="max-h-48 space-y-1 overflow-y-auto font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-white/45 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {result.checks.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
