"use client";

import { useGSAP } from "@gsap/react";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";

// ponytail: visual fill cap for typical mainnet jar sizes — not a hard limit
const FILL_CAP = 100;

type JarGaugeProps = {
  balance: number | null;
  display: string;
  activeSessions?: number;
};

export function JarGauge({
  balance,
  display,
  activeSessions = 0,
}: JarGaugeProps) {
  const root = useRef<HTMLDivElement>(null);
  const jar = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const balanceEl = useRef<HTMLSpanElement>(null);
  const statsEl = useRef<HTMLDivElement>(null);
  const [shownPct, setShownPct] = useState(0);

  const pct =
    balance == null || balance <= 0
      ? 0
      : Math.min(100, Math.max(8, (balance / FILL_CAP) * 100));

  const bubbles = Math.min(activeSessions, 4);

  useGSAP(
    () => {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      if (reduced) {
        if (fill.current) fill.current.style.height = `${pct}%`;
        if (balanceEl.current) balanceEl.current.textContent = display;
        setShownPct(Math.round(pct));
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (jar.current) {
        tl.fromTo(
          jar.current,
          { opacity: 0, scale: 0.88, y: 12 },
          { opacity: 1, scale: 1, y: 0, duration: 0.85 },
          0
        );
      }

      if (glow.current) {
        tl.fromTo(
          glow.current,
          { opacity: 0, scale: 0.7 },
          { opacity: 1, scale: 1, duration: 1.1, ease: "power2.out" },
          0.15
        );
      }

      if (fill.current) {
        tl.fromTo(
          fill.current,
          { height: "0%" },
          { height: `${pct}%`, duration: 1.75, ease: "power4.out" },
          0.25
        );
      }

      if (statsEl.current) {
        tl.fromTo(
          statsEl.current,
          { opacity: 0, x: 16 },
          { opacity: 1, x: 0, duration: 0.7 },
          0.45
        );
      }

      if (balanceEl.current && balance != null && !Number.isNaN(balance)) {
        const proxy = { val: 0 };
        tl.to(
          proxy,
          {
            val: balance,
            duration: 1.5,
            ease: "power2.out",
            onUpdate: () => {
              if (balanceEl.current) {
                balanceEl.current.textContent = proxy.val.toFixed(4);
              }
              setShownPct(
                Math.round(
                  Math.min(100, Math.max(0, (proxy.val / FILL_CAP) * 100))
                )
              );
            },
          },
          0.5
        );
      } else if (balanceEl.current) {
        balanceEl.current.textContent = display;
        setShownPct(Math.round(pct));
      }

      return () => {
        tl.kill();
      };
    },
    { scope: root, dependencies: [balance, display, pct] }
  );

  // Keep display in sync when not animating a number
  useEffect(() => {
    if (balance == null && balanceEl.current) {
      balanceEl.current.textContent = display;
      setShownPct(0);
    }
  }, [balance, display]);

  return (
    <div
      ref={root}
      className="jar-gauge flex flex-col items-center gap-7 sm:flex-row sm:items-end"
    >
      <div className="relative shrink-0">
        <div
          ref={glow}
          className="jar-glow pointer-events-none absolute -inset-6 rounded-full bg-emerald-500/10 blur-2xl"
          aria-hidden
        />
        <div ref={jar} className="relative" aria-hidden>
          <div className="mx-auto mb-0.5 h-2.5 w-14 rounded-sm border border-white/20 bg-gradient-to-b from-white/15 to-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />
          <div className="mx-auto -mb-px h-3 w-[4.5rem] rounded-t-md border border-b-0 border-white/12 bg-white/[0.04]" />
          <div className="jar-body relative h-[168px] w-[7.25rem] overflow-hidden rounded-b-[2.25rem] rounded-t-lg border border-white/[0.14] bg-white/[0.02] shadow-[inset_0_0_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="pointer-events-none absolute inset-y-3 left-1.5 w-2 rounded-full bg-gradient-to-b from-white/12 to-transparent" />
            <div
              ref={fill}
              className="jar-fill absolute bottom-0 left-0 right-0 overflow-hidden"
              style={{ height: 0 }}
            >
              <div className="jar-shimmer absolute inset-0 bg-gradient-to-t from-emerald-600/90 via-emerald-400/55 to-cyan-300/40" />
              <div className="jar-wave jar-wave--a absolute -top-2 left-[-12%] right-[-12%] h-5 rounded-[50%] bg-emerald-300/30 blur-[1px]" />
              <div className="jar-wave jar-wave--b absolute -top-3 left-[-8%] right-[-8%] h-4 rounded-[50%] bg-cyan-200/15 blur-[2px]" />
              {bubbles > 0
                ? Array.from({ length: bubbles }).map((_, i) => (
                    <span
                      key={i}
                      className="jar-bubble absolute bottom-[18%] h-1.5 w-1.5 rounded-full bg-white/55 shadow-[0_0_6px_rgba(255,255,255,0.4)]"
                      style={{
                        left: `${20 + i * 20}%`,
                        animationDelay: `${1.2 + i * 0.55}s`,
                      }}
                    />
                  ))
                : null}
            </div>
            {pct === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.2em] text-white/18">
                  empty
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={statsEl}
        className="min-w-0 text-center sm:flex-1 sm:pb-1 sm:text-left"
      >
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.2em] text-white/35">
          Allocated balance
        </p>
        <div className="mt-3 flex flex-wrap items-baseline justify-center gap-x-2 sm:justify-start">
          <span
            ref={balanceEl}
            className="font-[family-name:var(--font-space-grotesk)] text-[2.75rem] font-semibold leading-none tracking-[-0.04em] text-white tabular-nums md:text-[3.25rem]"
          >
            {display}
          </span>
          <span className="pb-1 font-[family-name:var(--font-jetbrains-mono)] text-xs text-white/35">
            XLM
          </span>
        </div>
        <p className="mt-2 font-[family-name:var(--font-jetbrains-mono)] text-[11px] text-white/30 transition-opacity duration-500">
          Stellar mainnet
          {balance != null ? ` · jar ${shownPct}% full` : null}
        </p>
        {activeSessions > 0 ? (
          <p className="jar-sessions-hint mt-1.5 text-[11px] text-emerald-400/75">
            {activeSessions} active session{activeSessions !== 1 ? "s" : ""}{" "}
            drawing from here
          </p>
        ) : null}
      </div>
    </div>
  );
}
