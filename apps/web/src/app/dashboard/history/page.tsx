"use client";

import { useEffect, useState } from "react";
import type { HorizonPaymentView, TransactionView } from "@pay3/shared";
import { HistoryHeader } from "@/components/dashboard/HistoryHeader";
import { apiFetch } from "@/lib/api";
import { stellarExpertTxUrl } from "@/lib/network";
import { truncateKey } from "@/lib/wallet";

function txStatusTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("success") || s.includes("complete")) {
    return "text-emerald-400/85 border-emerald-400/20 bg-emerald-500/[0.08]";
  }
  if (s.includes("fail") || s.includes("reject") || s.includes("block")) {
    return "text-rose-300/85 border-rose-400/20 bg-rose-500/[0.08]";
  }
  return "text-white/45 border-white/10 bg-white/[0.03]";
}

function horizonTypeTone(type: string) {
  if (type === "payment") {
    return "text-cyan-300/80 border-cyan-400/20 bg-cyan-500/[0.08]";
  }
  if (type === "create_account") {
    return "text-violet-300/80 border-violet-400/20 bg-violet-500/[0.08]";
  }
  return "text-white/40 border-white/10 bg-white/[0.03]";
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

export default function HistoryPage() {
  const [payments, setPayments] = useState<HorizonPaymentView[]>([]);
  const [transactions, setTransactions] = useState<TransactionView[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ payments: HorizonPaymentView[]; message?: string }>("/history"),
      apiFetch<{ transactions: TransactionView[] }>("/transactions"),
    ])
      .then(([h, t]) => {
        setPayments(h.payments);
        setMessage(h.message ?? null);
        setTransactions(t.transactions);
      })
      .catch((err) => {
        setMessage(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div data-dash-reveal className="history-page mx-auto max-w-5xl">
      <article className="overview-sheet overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#0e0e10]">
        <HistoryHeader
          pay3Count={loading ? null : transactions.length}
          horizonCount={loading ? null : payments.length}
        />

        <div className="grid lg:grid-cols-2">
          <div
            className="relative border-b border-white/[0.07] px-6 py-8 md:px-10 lg:border-b-0 lg:border-r lg:border-white/[0.07]"
            data-overview-block
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(34,211,238,0.05),transparent_55%)]"
              aria-hidden
            />
            <div className="relative">
              <SectionLabel count={transactions.length}>Pay3 transfers</SectionLabel>

              {loading ? (
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-white/35">
                  Loading…
                </p>
              ) : transactions.length === 0 ? (
                <EmptyBlock message="No Pay3 transfers yet." />
              ) : (
                <div className="session-list-scroll max-h-[24rem] rounded-lg border border-white/[0.07] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <ul className="divide-y divide-white/[0.06]">
                    {transactions.map((t) => (
                      <li
                        key={t.id}
                        className="px-3 py-3 transition-colors hover:bg-white/[0.02]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-[family-name:var(--font-space-grotesk)] text-[14px] font-semibold text-white/88">
                                {t.amount} {t.asset}
                              </p>
                              <span
                                className={`rounded-full border px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.1em] ${txStatusTone(t.status)}`}
                              >
                                {t.status}
                              </span>
                            </div>
                            <p className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-white/35">
                              {new Date(t.createdAt).toLocaleString()}
                              {t.policyDecision
                                ? ` · ${t.policyDecision.replace(/_/g, " ")}`
                                : ""}
                            </p>
                          </div>
                          {t.stellarTransactionHash ? (
                            <a
                              href={stellarExpertTxUrl(t.stellarTransactionHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-cyan-400/75 underline-offset-2 hover:text-cyan-300/90 hover:underline"
                            >
                              {truncateKey(t.stellarTransactionHash)}
                            </a>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-8 md:px-9 md:py-9" data-overview-block>
            <SectionLabel count={payments.length}>
              Horizon · allocation account
            </SectionLabel>

            {loading ? (
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.12em] text-white/35">
                Loading…
              </p>
            ) : message && payments.length === 0 ? (
              <EmptyBlock message={message} />
            ) : payments.length === 0 ? (
              <EmptyBlock message="No Horizon activity yet." />
            ) : (
              <div className="session-list-scroll max-h-[24rem] rounded-lg border border-white/[0.07] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <ul className="divide-y divide-white/[0.06]">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="px-3 py-3 transition-colors hover:bg-white/[0.02]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {p.amount ? (
                              <p className="font-[family-name:var(--font-space-grotesk)] text-[14px] font-semibold text-white/88">
                                {p.amount} {p.asset ?? "XLM"}
                              </p>
                            ) : (
                              <p className="font-[family-name:var(--font-space-grotesk)] text-[14px] font-semibold capitalize text-white/88">
                                {p.type.replace(/_/g, " ")}
                              </p>
                            )}
                            <span
                              className={`rounded-full border px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.1em] ${horizonTypeTone(p.type)}`}
                            >
                              {p.type.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="mt-1 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-white/35">
                            {new Date(p.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {p.transactionHash ? (
                          <a
                            href={stellarExpertTxUrl(p.transactionHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-cyan-400/75 underline-offset-2 hover:text-cyan-300/90 hover:underline"
                          >
                            {truncateKey(p.transactionHash)}
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
