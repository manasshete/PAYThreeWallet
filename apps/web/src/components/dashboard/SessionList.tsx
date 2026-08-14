"use client";

import { useGSAP } from "@gsap/react";
import { useRef, useState } from "react";
import type { SessionView } from "@pay3/shared";
import { truncateKey } from "@/lib/wallet";
import { gsap } from "@/lib/gsap";
import { ConfirmDialog } from "./ConfirmDialog";

const iconBtn =
  "flex h-7 w-7 items-center justify-center rounded-full border border-white/12 text-white/55 transition-colors hover:border-red-400/30 hover:bg-red-500/[0.08] hover:text-red-400/90";

function RevokeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6h7M6 2.5 6 9.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function statusTone(status: string, active: boolean) {
  if (active) return "text-emerald-400/80 border-emerald-400/20 bg-emerald-500/[0.08]";
  if (status === "expired") return "text-white/35 border-white/10 bg-white/[0.03]";
  return "text-red-400/70 border-red-400/15 bg-red-500/[0.05]";
}

type SessionListProps = {
  sessions: SessionView[];
  onRevoke: (id: string) => void;
};

export function SessionList({ sessions, onRevoke }: SessionListProps) {
  const list = useRef<HTMLUListElement>(null);
  const [pendingRevoke, setPendingRevoke] = useState<SessionView | null>(null);

  const pendingName = pendingRevoke
    ? pendingRevoke.label ?? pendingRevoke.clientType
    : "";

  useGSAP(
    () => {
      if (!list.current || !sessions.length) return;
      const rows = list.current.querySelectorAll("[data-session-row]");
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (reduced || !rows.length) return;

      gsap.fromTo(
        rows,
        { opacity: 0, y: 6 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.05,
          ease: "power3.out",
          clearProps: "transform",
        }
      );
    },
    { scope: list, dependencies: [sessions] }
  );

  if (sessions.length === 0) {
    return <p className="text-[11px] text-white/35">No sessions yet.</p>;
  }

  return (
    <>
      <ConfirmDialog
        open={pendingRevoke !== null}
        title={`Revoke ${pendingName}?`}
        body="This stops the AI client from using this session key immediately. You can create a new session anytime."
        confirmLabel="Revoke session"
        cancelLabel="Keep active"
        destructive
        onCancel={() => setPendingRevoke(null)}
        onConfirm={() => {
          if (!pendingRevoke) return;
          onRevoke(pendingRevoke.id);
          setPendingRevoke(null);
        }}
      />

      <div className="session-list-scroll max-h-[20rem] rounded-lg border border-white/[0.07] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <ul ref={list} className="divide-y divide-white/[0.06]">
        {sessions.map((s) => (
          <li
            key={s.id}
            data-session-row
            className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-[family-name:var(--font-space-grotesk)] text-[10px] font-semibold uppercase ${
                s.active
                  ? "border-violet-400/25 bg-violet-500/[0.1] text-white/85"
                  : "border-white/10 bg-white/[0.03] text-white/50"
              }`}
            >
              {(s.label ?? s.clientType).charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-[family-name:var(--font-space-grotesk)] text-[13px] font-medium text-white/85 capitalize">
                  {s.label ?? s.clientType}
                </p>
                <span
                  className={`shrink-0 rounded-full border px-1.5 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.1em] ${statusTone(s.status, s.active)}`}
                >
                  {s.active ? "active" : s.status}
                </span>
              </div>
              <p className="truncate font-[family-name:var(--font-jetbrains-mono)] text-[9px] text-white/38">
                {s.sessionPublicKey ? truncateKey(s.sessionPublicKey) : "—"}
                {s.expiresAt
                  ? ` · ${new Date(s.expiresAt).toLocaleString()}`
                  : ""}
              </p>
            </div>
            {s.active ? (
              <button
                type="button"
                onClick={() => setPendingRevoke(s)}
                className={`${iconBtn} opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100`}
                aria-label={`Revoke ${s.label ?? s.clientType}`}
              >
                <RevokeIcon />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
    </>
  );
}
