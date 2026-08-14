"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApprovalView } from "@pay3/shared";
import { ApprovalsHeader } from "@/components/dashboard/ApprovalsHeader";
import { apiFetch } from "@/lib/api";
import { stellarExpertTxUrl } from "@/lib/network";
import { truncateKey } from "@/lib/wallet";

function secondsLeft(expiresAt: string, nowMs: number): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - nowMs) / 1000));
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function displayStatus(approval: ApprovalView, nowMs: number): string {
  if (approval.status === "pending" && secondsLeft(approval.expiresAt, nowMs) === 0) {
    return "expired";
  }
  return approval.status;
}

function statusTone(status: string) {
  switch (status) {
    case "approved":
      return "text-emerald-400/85 border-emerald-400/20 bg-emerald-500/[0.08]";
    case "rejected":
      return "text-rose-300/85 border-rose-400/20 bg-rose-500/[0.08]";
    case "expired":
      return "text-white/40 border-white/10 bg-white/[0.03]";
    case "pending":
      return "text-amber-300/85 border-amber-400/20 bg-amber-500/[0.08]";
    default:
      return "text-white/45 border-white/10 bg-white/[0.03]";
  }
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-8 text-center">
      <p className="text-[13px] text-white/45">{message}</p>
    </div>
  );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.16em] text-white/38">
        {children}
      </p>
      {count != null ? (
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tabular-nums text-white/32">
          {count}
        </span>
      ) : null}
    </div>
  );
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const data = await apiFetch<{ approvals: ApprovalView[] }>("/approvals");
    setApprovals(data.approvals);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load");
      setLoading(false);
    });
  }, [refresh]);

  useEffect(() => {
    const tick = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const poll = window.setInterval(() => {
      refresh().catch(() => {});
    }, 15_000);
    return () => window.clearInterval(poll);
  }, [refresh]);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/approvals/${id}/approve`, { method: "POST" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/approvals/${id}/reject`, { method: "POST" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  const pending = approvals.filter(
    (a) => a.status === "pending" && secondsLeft(a.expiresAt, nowMs) > 0
  );

  const history = approvals.filter((a) => {
    if (a.status === "pending") {
      return secondsLeft(a.expiresAt, nowMs) === 0;
    }
    return a.status === "approved" || a.status === "rejected" || a.status === "expired";
  });

  return (
    <div data-dash-reveal className="approvals-page mx-auto max-w-5xl">
      <article className="overview-sheet overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#0e0e10]">
        <ApprovalsHeader
          pendingCount={loading ? null : pending.length}
          historyCount={loading ? null : history.length}
        />

        {error ? (
          <p
            className="border-b border-white/[0.07] px-6 py-3 text-[13px] text-red-400/90 md:px-10"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="grid lg:grid-cols-2">
          <div
            className="relative border-b border-white/[0.07] px-6 py-8 md:px-10 lg:border-b-0 lg:border-r lg:border-white/[0.07]"
            data-overview-block
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(245,158,11,0.06),transparent_55%)]"
              aria-hidden
            />
            <div className="relative">
              <SectionLabel count={pending.length}>Pending queue</SectionLabel>

              {loading ? (
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-white/35">
                  Loading…
                </p>
              ) : pending.length === 0 ? (
                <EmptyBlock message="No pending approvals." />
              ) : (
                <ul className="space-y-2.5">
                  {pending.map((a) => {
                    const left = secondsLeft(a.expiresAt, nowMs);
                    const urgent = left <= 30;
                    return (
                      <li
                        key={a.id}
                        className={`rounded-xl border px-3.5 py-3.5 transition-colors ${
                          urgent
                            ? "border-amber-400/25 bg-amber-500/[0.06]"
                            : "border-white/[0.08] bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-[family-name:var(--font-space-grotesk)] text-[15px] font-semibold text-white/90">
                              {a.transaction?.amount} {a.transaction?.asset}
                            </p>
                            <p className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-white/40">
                              →{" "}
                              {a.transaction?.recipient
                                ? truncateKey(a.transaction.recipient)
                                : "—"}
                            </p>
                            <p
                              className={`mt-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.12em] ${
                                urgent ? "text-amber-300/90" : "text-white/32"
                              }`}
                            >
                              Expires in {formatCountdown(left)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              disabled={busyId === a.id || left === 0}
                              onClick={() => approve(a.id)}
                              className="rounded-full bg-white px-4 py-2 text-[12px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-45"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={busyId === a.id || left === 0}
                              onClick={() => reject(a.id)}
                              className="rounded-full border border-white/12 px-4 py-2 text-[12px] text-white/65 transition-colors hover:border-white/25 hover:text-white/90 disabled:opacity-45"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="px-6 py-8 md:px-9 md:py-9" data-overview-block>
            <SectionLabel count={history.length}>Approval history</SectionLabel>

            {loading ? (
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-white/35">
                Loading…
              </p>
            ) : history.length === 0 ? (
              <EmptyBlock message="No resolved approvals yet." />
            ) : (
              <div className="session-list-scroll max-h-[24rem] rounded-lg border border-white/[0.07] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <ul className="divide-y divide-white/[0.06]">
                  {history.map((a) => {
                    const status = displayStatus(a, nowMs);
                    return (
                      <li
                        key={a.id}
                        className="px-3 py-3 transition-colors hover:bg-white/[0.02]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-[family-name:var(--font-space-grotesk)] text-[14px] font-semibold text-white/88">
                                {a.transaction?.amount ?? "—"}{" "}
                                {a.transaction?.asset ?? ""}
                              </p>
                              <span
                                className={`rounded-full border px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.1em] ${statusTone(status)}`}
                              >
                                {status}
                              </span>
                            </div>
                            <p className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-white/35">
                              {a.transaction?.recipient
                                ? `→ ${truncateKey(a.transaction.recipient)} · `
                                : ""}
                              {new Date(a.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {a.transaction?.stellarTransactionHash ? (
                            <a
                              href={stellarExpertTxUrl(a.transaction.stellarTransactionHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-cyan-400/75 underline-offset-2 hover:text-cyan-300/90 hover:underline"
                            >
                              {truncateKey(a.transaction.stellarTransactionHash)}
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
