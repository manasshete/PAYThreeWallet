"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Status = { configured: boolean; linked: boolean; linkedAt: string | null };

export function TelegramApprovals() {
  const [status, setStatus] = useState<Status | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await apiFetch<Status>("/notifications/telegram"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Telegram status");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // While a link is open, poll until the bot confirms the chat.
  useEffect(() => {
    if (!linkUrl || status?.linked) return;
    const t = setInterval(() => void refresh(), 3000);
    return () => clearInterval(t);
  }, [linkUrl, status?.linked, refresh]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiFetch<{ url: string }>("/notifications/telegram/link", {
        method: "POST",
      });
      setLinkUrl(url);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create link");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/notifications/telegram", { method: "DELETE" });
      setLinkUrl(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6"
      data-overview-block
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-white/90">
          Telegram approvals
        </h2>
        {status?.linked ? (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-wider text-emerald-300/90">
            Connected
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-white/55">
        When your AI needs approval to spend, get a message with Approve / Reject
        buttons — no need to keep this dashboard open. Requests expire after 2
        minutes.
      </p>

      {status && !status.configured ? (
        <p className="mt-4 text-[12px] text-white/40">
          Not available on this server (bot not configured).
        </p>
      ) : status?.linked ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void disconnect()}
          className="mt-4 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-50"
        >
          {busy ? "Disconnecting…" : "Disconnect Telegram"}
        </button>
      ) : status ? (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void connect()}
            className="rounded-lg border border-sky-400/40 bg-sky-500/15 px-4 py-2.5 text-sm font-medium text-sky-100 hover:bg-sky-500/25 disabled:opacity-50"
          >
            {busy ? "Opening…" : "Connect Telegram"}
          </button>
          {linkUrl ? (
            <p className="text-[12px] leading-relaxed text-white/45">
              Tap <strong className="text-white/70">Start</strong> in Telegram to
              finish. Didn&apos;t open?{" "}
              <a
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
                className="text-white/70 underline-offset-2 hover:underline"
              >
                Open the bot
              </a>{" "}
              (link valid 15 min).
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-red-400/90" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
