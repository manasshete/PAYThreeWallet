"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { useRef } from "react";
import { EXAMPLE_COMMANDS } from "@/lib/content";
import { useSiteRevealed } from "./site-revealed";

export function CommandTicker() {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const indexRef = useRef(0);
  const revealed = useSiteRevealed();

  useGSAP(
    () => {
      if (!revealed) return;

      const el = textRef.current;
      if (!el) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      const cycle = () => {
        gsap.to(el, {
          opacity: 0,
          y: -8,
          duration: 0.35,
          ease: "power2.in",
          onComplete: () => {
            indexRef.current = (indexRef.current + 1) % EXAMPLE_COMMANDS.length;
            if (textRef.current) {
              textRef.current.textContent = EXAMPLE_COMMANDS[indexRef.current];
            }
            gsap.fromTo(
              el,
              { opacity: 0, y: 8 },
              { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }
            );
          },
        });
      };

      const interval = setInterval(cycle, 3200);
      return () => clearInterval(interval);
    },
    { scope: containerRef, dependencies: [revealed] }
  );

  return (
    <div ref={containerRef} className="mt-6 border-l border-white/10 pl-4 md:mt-7">
      <p className="text-[10px] uppercase tracking-widest text-white/30">Try saying</p>
      <p
        ref={textRef}
        aria-live="polite"
        className="mt-2 font-mono text-sm text-white/55 md:text-base"
      >
        {EXAMPLE_COMMANDS[0]}
      </p>
    </div>
  );
}
