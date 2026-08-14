"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { SessionPolicyRules, SessionView } from "@pay3/shared";
import { SessionKeyring } from "@/components/dashboard/SessionKeyring";
import { SessionList } from "@/components/dashboard/SessionList";
import { SessionPolicyBlueprint } from "@/components/dashboard/SessionPolicyBlueprint";
import { SessionsHeader } from "@/components/dashboard/SessionsHeader";
import { apiFetch } from "@/lib/api";
import {
  fetchCurrentUser,
  signMessageWithFreighter,
  signTransactionWithFreighter,
} from "@/lib/wallet";

const DEFAULT_RULES: SessionPolicyRules = {
  durationHours: 24,
  dailyBudget: "100",
  asset: "XLM",
  perTxMax: "20",
  approvalAbove: "15",
  allowedActions: [
    "get_balance",
    "transfer",
    "get_transaction_history",
    "get_swap_quote",
  ],
  blockedNotes: [
    "Unknown contracts",
    "Unapproved assets",
    "Actions outside policy",
  ],
};

type Step = "list" | "form" | "review";

type Preview = {
  clientType: string;
  label: string | null;
  rules: SessionPolicyRules;
  allowed: string[];
  blocked: string[];
};

const inputClass =
  "mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/40 px-3.5 py-2.5 text-[14px] text-white outline-none transition-[border-color,background,box-shadow] duration-300 placeholder:text-white/25 focus:border-white/25 focus:bg-black/50 focus:shadow-[0_0_0_3px_rgba(255,255,255,0.04)]";

const fieldLabel =
  "font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.16em] text-white/28";

const primaryBtn =
  "inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-[13px] font-medium text-black transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-45 sm:w-auto";

const backBtn =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.12em] text-white/45 transition-colors hover:border-white/20 hover:text-white/70";

function SessionStepShell({
  eyebrow,
  title,
  subtitle,
  onBack,
  backLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  onBack: () => void;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <div data-dash-reveal className="sessions-page mx-auto max-w-5xl">
      <article className="overview-sheet overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#0e0e10]">
        <div className="border-b border-white/[0.07] px-6 py-6 md:px-10 md:py-7" data-overview-block>
          <button type="button" onClick={onBack} className={backBtn}>
            ← {backLabel}
          </button>
          <p className="mt-4 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-white/35">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-space-grotesk)] text-[2rem] font-semibold leading-none tracking-[-0.03em] text-white md:text-[2.35rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-white/45">
            {subtitle}
          </p>
        </div>
        {children}
      </article>
    </div>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [step, setStep] = useState<Step>("list");
  const [clientType, setClientType] = useState("claude");
  const [label, setLabel] = useState("");
  const [rules, setRules] = useState<SessionPolicyRules>(DEFAULT_RULES);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mcpToken, setMcpToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    const data = await apiFetch<{ sessions: SessionView[] }>("/sessions");
    setSessions(data.sessions);
  }, []);

  useEffect(() => {
    refresh().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load")
    );
  }, [refresh]);

  async function goToReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await apiFetch<Preview>("/sessions/preview", {
        method: "POST",
        body: JSON.stringify({
          clientType,
          label: label || undefined,
          rules,
        }),
      });
      setPreview(data);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function authorize() {
    setError(null);
    setBusy(true);
    try {
      const user = await fetchCurrentUser();
      if (!user?.publicKey) throw new Error("Not signed in");

      const challenge = await apiFetch<{
        nonce: string;
        message: string;
      }>("/sessions/challenge", {
        method: "POST",
        body: JSON.stringify({
          clientType,
          label: label || undefined,
          rules,
        }),
      });

      const signature = await signMessageWithFreighter(
        challenge.message,
        user.publicKey
      );

      const created = await apiFetch<{
        session: SessionView;
        mcpToken: string;
        onchainRegister?: { unsignedXdr: string } | null;
      }>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          clientType,
          label: label || undefined,
          rules,
          nonce: challenge.nonce,
          signature,
        }),
      });

      if (created.onchainRegister?.unsignedXdr) {
        const signedXdr = await signTransactionWithFreighter(
          created.onchainRegister.unsignedXdr,
          user.publicKey
        );
        await apiFetch(`/sessions/${created.session.id}/onchain-confirm`, {
          method: "POST",
          body: JSON.stringify({ signedXdr }),
        });
      }

      setMcpToken(created.mcpToken);
      setStep("list");
      setPreview(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorize failed");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      const user = await fetchCurrentUser();
      const result = await apiFetch<{
        session: SessionView;
        onchainRevoke?: { unsignedXdr: string } | null;
      }>(`/sessions/${id}/revoke`, { method: "POST" });

      if (result.onchainRevoke?.unsignedXdr && user?.publicKey) {
        const signedXdr = await signTransactionWithFreighter(
          result.onchainRevoke.unsignedXdr,
          user.publicKey
        );
        await apiFetch(`/sessions/${id}/onchain-confirm`, {
          method: "POST",
          body: JSON.stringify({ signedXdr }),
        });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    }
  }

  async function revokeAll() {
    const ok = window.confirm(
      "Revoke ALL AI sessions? MCP tokens stop working immediately."
    );
    if (!ok) return;
    setError(null);
    try {
      await apiFetch("/sessions/revoke-all", { method: "POST" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke all failed");
    }
  }

  async function copyToken() {
    if (!mcpToken) return;
    await navigator.clipboard.writeText(mcpToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (step === "form") {
    return (
      <SessionStepShell
        eyebrow="New session"
        title="Create AI session"
        subtitle="Scope what an AI client can do with your jar. Nothing goes live until you review and sign with Freighter."
        onBack={() => setStep("list")}
        backLabel="Sessions"
      >
        <div className="grid lg:grid-cols-[1fr_1.15fr]">
          <div
            className="relative border-b border-white/[0.07] px-6 py-8 md:px-10 lg:border-b-0 lg:border-r lg:border-white/[0.07]"
            data-overview-block
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(168,85,247,0.06),transparent_55%)]"
              aria-hidden
            />
            <div className="relative">
              <SessionPolicyBlueprint
                clientType={clientType}
                label={label}
                rules={rules}
              />
            </div>
          </div>

          <div className="px-6 py-8 md:px-9 md:py-9" data-overview-block>
            <form onSubmit={goToReview} className="space-y-4">
              <label className="block">
                <span className={fieldLabel}>AI client</span>
                <select
                  value={clientType}
                  onChange={(e) => setClientType(e.target.value)}
                  className={inputClass}
                >
                  <option value="claude">Claude</option>
                  <option value="cursor">Cursor</option>
                  <option value="chatgpt">ChatGPT</option>
                  <option value="other">Other MCP client</option>
                </select>
              </label>

              <label className="block">
                <span className={fieldLabel}>Label (optional)</span>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Work laptop"
                  className={inputClass}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={fieldLabel}>Duration (hours)</span>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={rules.durationHours}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        durationHours: Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabel}>Asset</span>
                  <input
                    value={rules.asset}
                    onChange={(e) =>
                      setRules({ ...rules, asset: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabel}>Daily budget</span>
                  <input
                    value={rules.dailyBudget}
                    onChange={(e) =>
                      setRules({ ...rules, dailyBudget: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={fieldLabel}>Per-transaction max</span>
                  <input
                    value={rules.perTxMax}
                    onChange={(e) =>
                      setRules({ ...rules, perTxMax: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={fieldLabel}>Require approval above</span>
                  <input
                    value={rules.approvalAbove}
                    onChange={(e) =>
                      setRules({ ...rules, approvalAbove: e.target.value })
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 accent-white"
                  checked={rules.allowedActions.includes("execute_swap")}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setRules({
                      ...rules,
                      allowedActions: on
                        ? [
                            ...new Set([
                              ...rules.allowedActions,
                              "execute_swap",
                            ]),
                          ]
                        : rules.allowedActions.filter(
                            (a) => a !== "execute_swap"
                          ),
                    });
                  }}
                />
                <span>
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[14px] font-medium text-white/90">
                    Allow DeFi swap execute
                  </span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-white/40">
                    Opt-in Soroswap execute_swap. Quotes alone do not need this.
                    Set SOROSWAP_API_KEY on API for live routes.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40 accent-white"
                  checked={rules.allowedActions.includes("x402_fetch")}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setRules({
                      ...rules,
                      allowedActions: on
                        ? [
                            ...new Set([
                              ...rules.allowedActions,
                              "x402_fetch",
                            ]),
                          ]
                        : rules.allowedActions.filter(
                            (a) => a !== "x402_fetch"
                          ),
                    });
                  }}
                />
                <span>
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[14px] font-medium text-white/90">
                    Allow x402 API payments
                  </span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-white/40">
                    Opt-in micropayments for paywalled HTTP APIs (402 → pay →
                    retry). Demo: /demo/x402/insight
                  </span>
                </span>
              </label>

              <div
                className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.01] p-4 opacity-60"
                aria-disabled
              >
                <input
                  type="checkbox"
                  disabled
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/40"
                />
                <span>
                  <span className="font-[family-name:var(--font-space-grotesk)] text-[14px] font-medium text-white/70">
                    Blend supply (coming soon)
                  </span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-white/35">
                    Policy-gated lending via Blend SDK — on the roadmap.
                  </span>
                </span>
              </div>

              {error ? (
                <p className="text-[13px] text-red-400/90" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" disabled={busy} className={primaryBtn}>
                {busy ? "Building preview…" : "Review permissions"}
              </button>
            </form>
          </div>
        </div>
      </SessionStepShell>
    );
  }

  if (step === "review" && preview) {
    return (
      <SessionStepShell
        eyebrow="Sign off"
        title="Permission review"
        subtitle="No AI gets financial authority until you sign with Freighter."
        onBack={() => setStep("form")}
        backLabel="Edit"
      >
        <div className="grid lg:grid-cols-[1fr_1.15fr]">
          <div
            className="relative border-b border-white/[0.07] px-6 py-8 md:px-10 lg:border-b-0 lg:border-r lg:border-white/[0.07]"
            data-overview-block
          >
            <SessionPolicyBlueprint
              clientType={preview.clientType}
              label={preview.label ?? ""}
              rules={preview.rules}
              mode="review"
            />
          </div>

          <div className="space-y-5 px-6 py-8 md:px-9 md:py-9" data-overview-block>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.04] p-4">
                <p className={fieldLabel}>Allowed</p>
                <ul className="mt-3 space-y-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-emerald-300/80">
                  {preview.allowed.map((a) => (
                    <li key={a}>✓ {a}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-red-400/12 bg-red-500/[0.03] p-4">
                <p className={fieldLabel}>Blocked</p>
                <ul className="mt-3 space-y-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-red-300/75">
                  {preview.blocked.map((b) => (
                    <li key={b}>✗ {b}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-black/30 p-4 font-[family-name:var(--font-jetbrains-mono)] text-[11px] leading-relaxed text-white/50">
              <p>
                Client:{" "}
                <span className="text-white/85 capitalize">
                  {preview.clientType}
                </span>
              </p>
              {preview.label ? (
                <p className="mt-1">
                  Label: <span className="text-white/85">{preview.label}</span>
                </p>
              ) : null}
            </div>

            {error ? (
              <p className="text-[13px] text-red-400/90" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={authorize}
              disabled={busy}
              className={primaryBtn}
            >
              {busy ? "Waiting for Freighter…" : "Authorize session"}
            </button>
          </div>
        </div>
      </SessionStepShell>
    );
  }

  return (
    <div data-dash-reveal className="sessions-page mx-auto max-w-5xl">
      <article className="overview-sheet overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#0e0e10]">
        <SessionsHeader
          activeCount={sessions.filter((s) => s.active).length}
          totalCount={sessions.length}
          onRevokeAll={revokeAll}
          onNewSession={() => {
            setError(null);
            setMcpToken(null);
            setStep("form");
          }}
        />

        <div className="grid lg:grid-cols-[1.05fr_1.15fr]">
          <div
            className="relative border-b border-white/[0.07] px-6 py-8 md:px-10 lg:border-b-0 lg:border-r lg:border-white/[0.07]"
            data-overview-block
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(168,85,247,0.06),transparent_55%)]"
              aria-hidden
            />
            <div className="relative">
              <SessionKeyring sessions={sessions} />

              <div className="mt-6 border-t border-white/[0.07] pt-4">
                <div
                  className="mb-3 flex items-center gap-1"
                  role="tablist"
                  aria-label="Session views"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected
                    className="relative px-2 py-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.16em] text-white/75"
                  >
                    All sessions
                    {sessions.length > 0 ? (
                      <span className="ml-1.5 text-white/35">{sessions.length}</span>
                    ) : null}
                    <span
                      className="absolute inset-x-2 -bottom-1 h-px bg-white/45"
                      aria-hidden
                    />
                  </button>
                </div>

                <SessionList sessions={sessions} onRevoke={revoke} />
              </div>
            </div>
          </div>

          <div className="px-6 py-8 md:px-9 md:py-9" data-overview-block>
            <div className="space-y-4">
              <div>
                <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold tracking-[-0.02em]">
                  Hand off access
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">
                  Create a scoped session for Claude, Cursor, or any MCP client.
                  You sign with Freighter — the AI never sees your main key.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMcpToken(null);
                  setStep("form");
                }}
                className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-[13px] font-medium text-black transition-[transform] duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                New session
              </button>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.14em] text-white/28">
                  Default limits
                </p>
                <ul className="mt-3 space-y-1.5 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-white/45">
                  <li>24h duration · 100 XLM daily budget</li>
                  <li>20 XLM per tx · approval above 15</li>
                  <li>Balance, transfer, history, swap quote</li>
                </ul>
              </div>
            </div>

            {mcpToken ? (
              <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <h2 className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold">
                  MCP token — copy now
                </h2>
                <p className="mt-1 text-[13px] text-white/55">
                  Shown once. Hosted Cursor config uses{" "}
                  <code className="text-white/80">https://pay3-api.vercel.app/mcp</code>{" "}
                  — see{" "}
                  <Link
                    href="/guide/cursor-mcp"
                    className="text-white underline underline-offset-4"
                  >
                    Cursor MCP setup
                  </Link>
                  .
                </p>
                <code className="mt-3 block break-all rounded-lg border border-white/10 bg-black/40 px-3 py-2 font-[family-name:var(--font-jetbrains-mono)] text-xs text-white/75">
                  {mcpToken}
                </code>
                <pre className="mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-[family-name:var(--font-jetbrains-mono)] text-[11px] leading-relaxed text-white/70">
{`{
  "mcpServers": {
    "pay3": {
      "url": "https://pay3-api.vercel.app/mcp",
      "headers": {
        "Authorization": "Bearer ${mcpToken}"
      }
    }
  }
}`}
                </pre>
                <button
                  type="button"
                  onClick={copyToken}
                  className="mt-3 rounded-full border border-white/20 px-4 py-2 text-[12px] transition-colors hover:bg-white/[0.06]"
                >
                  {copied ? "Copied" : "Copy token"}
                </button>
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 text-[13px] text-red-400/90" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}
