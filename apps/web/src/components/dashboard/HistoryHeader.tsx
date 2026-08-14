"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { gsap } from "@/lib/gsap";

type HistoryHeaderProps = {
  pay3Count: number | null;
  horizonCount: number | null;
};

export function HistoryHeader({ pay3Count, horizonCount }: HistoryHeaderProps) {
  const root = useRef<HTMLDivElement>(null);
  const pay3El = useRef<HTMLSpanElement>(null);
  const horizonEl = useRef<HTMLSpanElement>(null);

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
        if (pay3El.current && pay3Count != null) {
          pay3El.current.textContent = String(pay3Count);
        }
        if (horizonEl.current && horizonCount != null) {
          horizonEl.current.textContent = String(horizonCount);
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
    },
    { scope: root, dependencies: [pay3Count, horizonCount] }
  );

  return (
    <div
      ref={root}
      className="overview-hero relative border-b border-white/[0.07] px-6 py-7 md:px-10 md:py-8"
    >
      <div
        data-hero-beam
        className="overview-hero-beam pointer-events-none absolute inset-x-6 bottom-0 h-px origin-left bg-gradient-to-r from-transparent via-cyan-400/35 to-transparent md:inset-x-10"
        aria-hidden
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div data-overview-block>
          <p
            data-hero-label
            className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-white/35"
          >
            Audit trail
          </p>
          <h1
            data-hero-title
            className="mt-2 font-[family-name:var(--font-space-grotesk)] text-[2rem] font-semibold leading-none tracking-[-0.03em] text-white md:text-[2.35rem]"
          >
            Transaction history
          </h1>
          <p
            data-hero-sub
            className="mt-3 max-w-xl text-[14px] leading-relaxed text-white/45"
          >
            Pay3 lifecycle records plus on-chain Horizon activity for your
            allocation account.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5" data-overview-block>
          <div
            data-hero-stat
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3"
          >
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.16em] text-white/32">
              Pay3 transfers
            </p>
            <p className="mt-1 font-[family-name:var(--font-space-grotesk)] text-[1.35rem] font-semibold tabular-nums text-white">
              <span ref={pay3El}>{pay3Count ?? "—"}</span>
            </p>
          </div>
          <div
            data-hero-stat
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3"
          >
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.16em] text-white/32">
              On-chain
            </p>
            <p className="mt-1 font-[family-name:var(--font-space-grotesk)] text-[1.35rem] font-semibold tabular-nums text-white">
              <span ref={horizonEl}>{horizonCount ?? "—"}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
