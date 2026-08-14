"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { gsap } from "@/lib/gsap";

type ResolveResultBoxProps = {
  result: string;
  compact?: boolean;
};

export function ResolveResultBox({ result, compact }: ResolveResultBoxProps) {
  const box = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!box.current) return;
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (reduced) return;

      gsap.fromTo(
        box.current,
        { opacity: 0, y: 8, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          ease: "back.out(1.8)",
        }
      );
    },
    { dependencies: [result] }
  );

  return (
    <div
      ref={box}
      className={`contacts-resolve-result overflow-hidden rounded-lg border border-emerald-400/25 bg-emerald-500/[0.07] ${
        compact ? "mt-2 px-2.5 py-2" : "mt-5 rounded-xl px-3.5 py-3"
      }`}
    >
      <p className="font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.14em] text-emerald-400/80">
        Resolved
      </p>
      <p
        className={`mt-1 break-all font-[family-name:var(--font-jetbrains-mono)] leading-relaxed text-white/80 ${
          compact ? "text-[10px]" : "text-[12px]"
        }`}
      >
        {result}
      </p>
    </div>
  );
}
