"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import type { SessionView } from "@pay3/shared";
import { gsap } from "@/lib/gsap";
import { clientVariant } from "./GlowCard";

function fusePercent(session: SessionView): number {
  if (!session.active || !session.expiresAt) return 0;
  const end = new Date(session.expiresAt).getTime();
  const start = new Date(session.createdAt).getTime();
  const now = Date.now();
  if (end <= start) return 0;
  return Math.max(0, Math.min(100, ((end - now) / (end - start)) * 100));
}

function sessionDisplayName(session: SessionView): string {
  return session.label?.trim() || session.clientType;
}

function sessionIconText(session: SessionView): string {
  switch (session.clientType.toLowerCase()) {
    case "cursor":
      return "Cu";
    case "chatgpt":
      return "GPT";
    case "claude":
      return "Cl";
    default:
      return session.clientType.slice(0, 2).toUpperCase();
  }
}

function timeRemaining(expiresAt: string | null): string {
  if (!expiresAt) return "—";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expiring";
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours >= 48) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  return `${mins}m left`;
}

const VARIANT_ACCENT: Record<
  ReturnType<typeof clientVariant>,
  { icon: string; bar: string; edge: string }
> = {
  amber: {
    icon: "border-amber-400/25 bg-amber-500/10 text-amber-200/90",
    bar: "from-amber-400/90 to-amber-300/50",
    edge: "from-amber-400/50 via-amber-400/10 to-transparent",
  },
  violet: {
    icon: "border-violet-400/25 bg-violet-500/10 text-violet-200/90",
    bar: "from-violet-400/90 to-violet-300/50",
    edge: "from-violet-400/50 via-violet-400/10 to-transparent",
  },
  emerald: {
    icon: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200/90",
    bar: "from-emerald-400/90 to-emerald-300/50",
    edge: "from-emerald-400/50 via-emerald-400/10 to-transparent",
  },
  cyan: {
    icon: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200/90",
    bar: "from-cyan-400/90 to-cyan-300/50",
    edge: "from-cyan-400/50 via-cyan-400/10 to-transparent",
  },
  slate: {
    icon: "border-white/12 bg-white/[0.06] text-white/55",
    bar: "from-white/50 to-white/20",
    edge: "from-white/20 via-white/5 to-transparent",
  },
};

function LiveSessionCard({ session }: { session: SessionView }) {
  const fuse = fusePercent(session);
  const low = fuse < 25;
  const variant = clientVariant(session.clientType);
  const accent = VARIANT_ACCENT[variant];

  return (
    <article
      data-glow-card={session.id}
      className="session-live-card group relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#101012]/90 p-3 transition-[border-color,background] duration-300 hover:border-white/[0.14] hover:bg-[#121216]"
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accent.edge}`}
        aria-hidden
      />

      <div className="flex items-start gap-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-[family-name:var(--font-jetbrains-mono)] text-[10px] font-semibold tracking-tight ${accent.icon}`}
        >
          {sessionIconText(session)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-[family-name:var(--font-space-grotesk)] text-[13px] font-semibold leading-tight text-white/90 capitalize">
                {sessionDisplayName(session)}
              </p>
              <p className="mt-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.14em] text-white/32">
                {session.clientType}
              </p>
            </div>
            <span
              className={`shrink-0 font-[family-name:var(--font-jetbrains-mono)] text-[9px] tabular-nums ${
                low ? "text-rose-300/75" : "text-white/38"
              }`}
            >
              {timeRemaining(session.expiresAt)}
            </span>
          </div>

          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ${
                low ? "from-rose-400/85 to-rose-300/45" : accent.bar
              }`}
              style={{ width: `${fuse}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

type SessionKeyringProps = {
  sessions: SessionView[];
};

export function SessionKeyring({ sessions }: SessionKeyringProps) {
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLUListElement>(null);

  const allActive = sessions.filter((s) => s.active);
  const scrollable = allActive.length > 4;

  useGSAP(
    () => {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (reduced) return;

      const cards = grid.current?.querySelectorAll("[data-glow-card]");
      if (cards?.length) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: 0.45,
            stagger: 0.05,
            ease: "power3.out",
            clearProps: "transform",
          }
        );
      }
    },
    { scope: root, dependencies: [sessions] }
  );

  return (
    <div ref={root} className="session-keyring-wrap" data-overview-block>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.16em] text-white/40">
          Live sessions
        </p>
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] tabular-nums text-white/45">
          {allActive.length} live
        </span>
      </div>

      {allActive.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-7 text-center">
          <p className="font-[family-name:var(--font-space-grotesk)] text-[14px] font-medium text-white/55">
            No live sessions
          </p>
          <p className="mt-1 text-[11px] text-white/30">
            Create a session to arm an AI client
          </p>
        </div>
      ) : (
        <ul
          ref={grid}
          className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${
            scrollable ? "session-keyring-scroll max-h-[20rem]" : ""
          }`}
        >
          {allActive.map((s) => (
            <li key={s.id}>
              <LiveSessionCard session={s} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
