"use client";

import { useCallback, useEffect, useState } from "react";
import type { SmartAccountView, UsageView, UserProfile } from "@pay3/shared";
import { AddressQr } from "@/components/dashboard/AddressQr";
import { JarGauge } from "@/components/dashboard/JarGauge";
import { OverviewHeader } from "@/components/dashboard/OverviewHeader";
import { apiFetch } from "@/lib/api";
import { stellarExpertTxUrl } from "@/lib/network";
import { fetchCurrentUser, fundJarFromFreighter, truncateKey } from "@/lib/wallet";

export default function DashboardOverviewPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [account, setAccount] = useState<SmartAccountView | null>(null);
  const [usage, setUsage] = useState<UsageView | null>(null);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState("");
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [fundTxHash, setFundTxHash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [user, sa, usageRes] = await Promise.all([
        fetchCurrentUser().catch(() => null),
        apiFetch<{ smartAccount: SmartAccountView | null }>("/smart-account").catch(
          () => ({ smartAccount: null })
        ),
        apiFetch<{ usage: UsageView }>("/usage").catch(() => ({ usage: null })),
      ]);
      setProfile(user);
      setAccount(sa.smartAccount);
      setUsage(usageRes.usage);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      /* refresh handles errors */
    });
  }, [refresh]);

  async function handleLink() {
    setLinking(true);
    setError(null);
    try {
      await apiFetch("/smart-account/link", { method: "POST" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Link failed");
    } finally {
      setLinking(false);
    }
  }

  async function copyAddress() {
    if (!account?.publicKey) return;
    await navigator.clipboard.writeText(account.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleFund() {
    if (!account?.publicKey || !profile?.publicKey) return;
    setFunding(true);
    setFundError(null);
    setFundTxHash(null);
    try {
      const hash = await fundJarFromFreighter(
        account.publicKey,
        amount,
        profile.publicKey
      );
      setFundTxHash(hash);
      setAmount("");
      await refresh();
    } catch (err) {
      setFundError(err instanceof Error ? err.message : "Funding failed");
    } finally {
      setFunding(false);
    }
  }

  const linked = Boolean(account?.publicKey && account.status !== "pending");
  const balanceDisplay = linked ? (account?.xlmBalance ?? "0") : "—";
  const balanceNum = linked ? parseFloat(account?.xlmBalance ?? "0") : null;

  return (
    <div data-dash-reveal className="overview-page mx-auto max-w-5xl">
      <article className="overview-sheet overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#0e0e10]">
        <OverviewHeader
          linked={linked}
          accountLabel={
            linked
              ? truncateKey(account!.publicKey!)
              : account?.status ?? "—"
          }
          activeSessions={profile?.activeSessions ?? null}
          usage={usage}
        />

        {/* Balance + fund — one continuous plane */}
        <div className="grid lg:grid-cols-[1.05fr_1.15fr]">
          <div className="relative border-b border-white/[0.07] px-6 py-9 md:px-10 lg:border-b-0 lg:border-r lg:border-white/[0.07]" data-overview-block>
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.05),transparent_55%)]"
              aria-hidden
            />
            <div className="relative">
              <JarGauge
                balance={balanceNum}
                display={balanceDisplay}
                activeSessions={profile?.activeSessions ?? 0}
              />

              {account?.balances && account.balances.length > 0 ? (
                <ul className="overview-balance-list mt-8 space-y-2 border-t border-white/[0.07] pt-6">
                  {account.balances.map((b, i) => (
                    <li
                      key={b.asset}
                      className="overview-balance-row flex items-baseline justify-between gap-4 font-[family-name:var(--font-jetbrains-mono)] text-[13px]"
                      style={{ animationDelay: `${0.15 + i * 0.06}s` }}
                    >
                      <span className="text-white/35">{b.asset}</span>
                      <span className="text-white/80">{b.balance}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="px-6 py-8 md:px-9 md:py-9" data-overview-block>
            {!linked ? (
              <div className="flex h-full flex-col justify-center">
                <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold tracking-[-0.02em]">
                  Link smart account
                </h2>
                <p className="mt-2 max-w-md text-[14px] leading-relaxed text-white/45">
                  Creates a dedicated mainnet jar. Primary Freighter key never
                  leaves your wallet.
                </p>
                <button
                  type="button"
                  onClick={handleLink}
                  disabled={linking}
                  className="mt-7 inline-flex w-fit items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-45"
                >
                  {linking ? "Creating…" : "Link smart account"}
                </button>
                {error ? (
                  <p className="mt-3 text-sm text-red-400/90" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-7 sm:flex-row sm:gap-8">
                <div className="flex shrink-0 flex-col items-center gap-2.5 sm:items-start">
                  {account?.publicKey ? (
                    <AddressQr publicKey={account.publicKey} size={140} />
                  ) : null}
                  <p className="text-center text-[10px] leading-snug text-white/30 sm:text-left">
                    Scan · Freighter mainnet
                  </p>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold tracking-[-0.02em]">
                    Fund the jar
                  </h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">
                    Only funds here are available to AI sessions.
                  </p>

                  <div className="mt-5">
                    <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.18em] text-white/28">
                      Address
                    </p>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                      <code className="min-w-0 flex-1 break-all rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] leading-relaxed text-white/70">
                        {account?.publicKey}
                      </code>
                      <button
                        type="button"
                        onClick={copyAddress}
                        className="shrink-0 rounded-full border border-white/12 px-4 py-2 text-xs text-white/75 transition-[background,border-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-white/25 hover:bg-white/[0.06] hover:text-white active:scale-[0.97]"
                      >
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.18em] text-white/28">
                      Add from Freighter
                    </p>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                      <div className="relative min-w-0 flex-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.0000001"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          disabled={funding}
                          className="w-full rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 pr-12 font-[family-name:var(--font-jetbrains-mono)] text-[13px] text-white/85 outline-none transition-colors placeholder:text-white/25 focus:border-white/25 disabled:opacity-50"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.12em] text-white/30">
                          XLM
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleFund}
                        disabled={funding || !amount || Number(amount) <= 0}
                        className="shrink-0 rounded-full bg-white px-5 py-2.5 text-xs font-medium text-black transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
                      >
                        {funding ? "Confirm in Freighter…" : "Add XLM"}
                      </button>
                    </div>
                    {fundError ? (
                      <p className="mt-2 text-[12px] text-red-400/90" role="alert">
                        {fundError}
                      </p>
                    ) : null}
                    {fundTxHash ? (
                      <p className="mt-2 text-[12px] text-emerald-300/90">
                        Sent ·{" "}
                        <a
                          href={stellarExpertTxUrl(fundTxHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline decoration-emerald-300/30 underline-offset-4 hover:text-emerald-200"
                        >
                          view transaction
                        </a>
                      </p>
                    ) : null}
                  </div>

                  <ol className="mt-6 flex flex-col gap-2.5">
                    <Step n={1}>Type an amount and confirm in Freighter</Step>
                    <Step n={2}>Or scan / paste the address to send manually</Step>
                    <Step n={3}>
                      <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="text-white/80 underline decoration-white/20 underline-offset-4 transition-colors hover:text-white disabled:opacity-50"
                      >
                        {refreshing ? "Refreshing…" : "Refresh balances"}
                      </button>
                    </Step>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[12px] text-white/45">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-white/35">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
