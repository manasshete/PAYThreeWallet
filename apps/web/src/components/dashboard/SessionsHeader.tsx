"use client";

import { useGSAP } from "@gsap/react";
import type { HTMLAttributes, ReactNode } from "react";
import { useRef } from "react";
import { gsap } from "@/lib/gsap";

type SessionsHeaderProps = {
  activeCount: number | null;
  totalCount: number | null;
  onRevokeAll: () => void;
  onNewSession: () => void;
};

export function SessionsHeader({
  activeCount,
  totalCount,
  onRevokeAll,
  onNewSession,
}: SessionsHeaderProps) {
  const root = useRef<HTMLDivElement>(null);
  const activeEl = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const label = el.querySelector("[data-hero-label]");
      const title = el.querySelector("[data-hero-title]");
      const sub = el.querySelector("[data-hero-sub]");
      const stats = el.querySelectorAll("[data-hero-stat]");
      const beam = el.querySelector("[data-hero-beam]");

      if (reduced) {
        if (activeEl.current && activeCount != null) {
          activeEl.current.textContent = String(activeCount);
        }
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (beam) {
        tl.fromTo(
          beam,
          { scaleX: 0, opacity: 0 },
          { scaleX: 1, opacity: 1, duration: 1.1, ease: "power2.inOut" },
          0
        );
      }
      if (label) {
        tl.fromTo(label, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5 }, 0.1);
      }
      if (title) {
        tl.fromTo(title, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7 }, 0.18);
      }
      if (sub) {
        tl.fromTo(sub, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.55 }, 0.32);
      }
      if (stats.length) {
        tl.fromTo(
          stats,
          { opacity: 0, y: 14, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            stagger: 0.1,
            clearProps: "transform",
          },
          0.42
        );
      }
      if (activeEl.current && activeCount != null) {
        const proxy = { n: 0 };
        tl.to(
          proxy,
          {
            n: activeCount,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: () => {
              if (activeEl.current) {
                activeEl.current.textContent = String(Math.round(proxy.n));
              }
            },
          },
          0.65
        );
      }
    },
    { scope: root, dependencies: [activeCount, totalCount] }
  );

  return (
    <div
      ref={root}
      className="overview-hero relative border-b border-white/[0.07] px-6 py-7 md:px-10 md:py-8"
    >
      <div
        data-hero-beam
        className="overview-hero-beam pointer-events-none absolute inset-x-6 bottom-0 h-px origin-left bg-gradient-to-r from-transparent via-violet-400/40 to-transparent md:inset-x-10"
        aria-hidden
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div data-overview-block>
          <p
            data-hero-label
            className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-white/35"
          >
            AI access
          </p>
          <h1
            data-hero-title
            className="mt-2 font-[family-name:var(--font-space-grotesk)] text-[2.15rem] font-semibold leading-none tracking-[-0.03em] text-white md:text-[2.75rem]"
          >
            Sessions
          </h1>
          <p
            data-hero-sub
            className="mt-3 max-w-xl text-[14px] leading-relaxed text-white/45"
          >
            Each AI client gets an independent session with its own limits. Keys
            stay encrypted on the server — never in the browser or AI.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:flex-col lg:items-end">
          <div className="flex flex-wrap gap-2.5" data-overview-block>
            <StatPill label="Active" data-hero-stat>
              <span
                ref={activeEl}
                className="font-[family-name:var(--font-space-grotesk)] text-[15px] font-semibold tabular-nums text-white"
              >
                {activeCount ?? "…"}
              </span>
            </StatPill>
            <StatPill label="Total" data-hero-stat>
              <span className="font-[family-name:var(--font-space-grotesk)] text-[15px] font-semibold tabular-nums text-white/80">
                {totalCount ?? "…"}
              </span>
            </StatPill>
            <StatPill label="Keys" data-hero-stat>
              <span className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-emerald-400/85">
                server-only
              </span>
            </StatPill>
          </div>
          <div className="flex flex-wrap gap-2" data-overview-block>
            <button
              type="button"
              onClick={onRevokeAll}
              className="rounded-full border border-white/12 px-4 py-2 text-[12px] text-white/55 transition-[background,border-color] duration-300 hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
            >
              Revoke all
            </button>
            <button
              type="button"
              onClick={onNewSession}
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-[13px] font-medium text-black transition-[transform] duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              New session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  label,
  children,
  ...rest
}: {
  label: string;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className="overview-stat-pill min-w-[5.5rem] rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 transition-[border-color,background] duration-500 hover:border-white/[0.14] hover:bg-white/[0.05]"
    >
      <p className="font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.18em] text-white/28">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
