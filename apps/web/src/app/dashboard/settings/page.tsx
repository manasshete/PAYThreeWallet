"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SettingsHeader } from "@/components/dashboard/SettingsHeader";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { apiFetch } from "@/lib/api";

import { IS_MAINNET } from "@/lib/network";

export default function SettingsPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  async function revokeAllAiAccess() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await apiFetch<{ revoked: number }>("/sessions/revoke-all", {
        method: "POST",
      });
      setMessage(
        data.revoked === 0
          ? "No active sessions to revoke."
          : `Revoked ${data.revoked} AI session${data.revoked === 1 ? "" : "s"}.`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusy(false);
      setConfirmRevoke(false);
    }
  }

  return (
    <div data-dash-reveal className="settings-page mx-auto max-w-5xl">
      <article className="overview-sheet overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-[#0e0e10]">
        <SettingsHeader />

        <div className="space-y-8 px-6 py-8 md:px-10">
          <section
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6"
            data-overview-block
          >
            <h2 className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-white/90">
              Network & MCP
            </h2>
            <dl className="mt-4 space-y-3 font-[family-name:var(--font-jetbrains-mono)] text-[11px]">
              <div className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] pb-2">
                <dt className="text-white/35">Stellar network</dt>
                <dd className={IS_MAINNET ? "text-emerald-300/80" : "text-white/70"}>
                  {IS_MAINNET ? "Mainnet" : "Testnet"}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] pb-2">
                <dt className="text-white/35">MCP endpoint</dt>
                <dd className="text-white/65">/mcp (Bearer session token)</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-white/35">Tools</dt>
                <dd className="max-w-md text-right text-white/55">
                  balance · transfer · history · swap quote · execute swap ·
                  x402_fetch
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-[12px] leading-relaxed text-white/40">
              Docs:{" "}
              <a
                href="https://pay3.mintlify.site"
                className="text-white/60 underline-offset-2 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                pay3.mintlify.site
              </a>
              {" · "}
              x402 demo:{" "}
              <code className="text-white/50">GET /demo/x402/insight</code>
            </p>
          </section>

          <section
            className="rounded-xl border border-red-500/25 bg-red-500/[0.04] p-6"
            data-overview-block
          >
            <h2 className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-red-200">
              Emergency — revoke all AI access
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              Kills every active AI session and invalidates MCP tokens immediately.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmRevoke(true)}
              className="mt-4 rounded-lg border border-red-400/50 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-100 hover:bg-red-500/25 disabled:opacity-50"
            >
              {busy ? "Revoking…" : "Revoke all AI access"}
            </button>
            {message ? (
              <p className="mt-3 text-sm text-white/70" role="status">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="mt-3 text-sm text-red-400/90" role="alert">
                {error}
              </p>
            ) : null}
          </section>
        </div>
      </article>

      <ConfirmDialog
        open={confirmRevoke}
        title="Revoke all AI sessions?"
        body="MCP tokens stop working immediately. Create new sessions to reconnect."
        confirmLabel="Revoke all"
        destructive
        onCancel={() => setConfirmRevoke(false)}
        onConfirm={() => void revokeAllAiAccess()}
      />
    </div>
  );
}
