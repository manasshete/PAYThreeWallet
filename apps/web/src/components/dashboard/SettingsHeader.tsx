"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { gsap } from "@/lib/gsap";

export function SettingsHeader() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (reduced) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      const beam = el.querySelector("[data-hero-beam]");
      const label = el.querySelector("[data-hero-label]");
      const title = el.querySelector("[data-hero-title]");
      const sub = el.querySelector("[data-hero-sub]");

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
    },
    { scope: root }
  );

  return (
    <div
      ref={root}
      className="overview-hero relative border-b border-white/[0.07] px-6 py-7 md:px-10 md:py-8"
    >
      <div
        data-hero-beam
        className="overview-hero-beam pointer-events-none absolute inset-x-6 bottom-0 h-px origin-left bg-gradient-to-r from-transparent via-rose-400/25 to-transparent md:inset-x-10"
        aria-hidden
      />

      <div data-overview-block>
        <p
          data-hero-label
          className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.22em] text-white/35"
        >
          Account
        </p>
        <h1
          data-hero-title
          className="mt-2 font-[family-name:var(--font-space-grotesk)] text-[2rem] font-semibold leading-none tracking-[-0.03em] text-white md:text-[2.35rem]"
        >
          Settings
        </h1>
        <p
          data-hero-sub
          className="mt-3 max-w-xl text-[14px] leading-relaxed text-white/45"
        >
          Network info, MCP setup, and emergency controls. Revoking sessions
          takes effect immediately on the server.
        </p>
      </div>
    </div>
  );
}
