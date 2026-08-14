"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { useRef } from "react";
import { TECH_STACK } from "@/lib/content";

export function TechStack() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-tech-title]", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
        },
      });

      const track = trackRef.current;
      if (!track) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      const width = track.scrollWidth / 2;
      gsap.to(track, {
        x: -width,
        duration: 28,
        ease: "none",
        repeat: -1,
      });
    },
    { scope: sectionRef }
  );

  const items = [...TECH_STACK, ...TECH_STACK];

  return (
    <section
      ref={sectionRef}
      className="section-light overflow-hidden py-20 md:py-28"
    >
      <h2
        data-tech-title
        className="text-center font-display text-4xl font-bold tracking-tight md:text-5xl"
      >
        Technology Stack
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-center text-sm text-black/45">
        Stellar settlement, Soroban smart contracts, MCP for AI agents, and
        Blend · Phoenix · Aquarius for DeFi.
      </p>

      <div className="relative mt-14 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent" />

        <div ref={trackRef} className="marquee-track gap-16 px-8">
          {items.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="shrink-0 font-display text-xl font-semibold tracking-tight text-black/50 md:text-2xl"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
