"use client";

import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useRef } from "react";
import { FLOW_STEPS } from "@/lib/content";

const STEP_TAGS = ["INPUT", "MCP", "POLICY", "AUTH", "SETTLE"] as const;

export function FlowSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-flow-title]", {
        y: 30,
        opacity: 0,
        duration: 0.7,
        scrollTrigger: { trigger: sectionRef.current, start: "top 75%" },
      });

      const steps = gsap.utils.toArray<HTMLElement>("[data-flow-step]");
      steps.forEach((step, i) => {
        gsap.from(step, {
          y: 32,
          opacity: 0,
          duration: 0.55,
          delay: i * 0.06,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 68%",
          },
        });
      });

      gsap.fromTo(
        "[data-flow-line]",
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 1.4,
          ease: "power2.inOut",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 62%",
            end: "bottom 45%",
            scrub: 0.8,
          },
        }
      );

      gsap.utils.toArray<HTMLElement>("[data-flow-node]").forEach((node, i) => {
        gsap.from(node, {
          scale: 0,
          opacity: 0,
          duration: 0.4,
          delay: 0.15 + i * 0.08,
          ease: "back.out(2)",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 65%",
          },
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-black py-24 md:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.07),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(to bottom, black, transparent 85%)",
        }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-6 md:px-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/35">
          The pipeline
        </p>
        <h2
          data-flow-title
          className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-5xl"
        >
          One command. Five layers of validation. Then it settles on Stellar.
        </h2>

        <div className="relative mt-16 md:mt-20">
          <div
            data-flow-line
            className="absolute left-[10%] right-[10%] top-5 hidden h-px origin-left bg-gradient-to-r from-transparent via-white/25 to-transparent md:block"
            aria-hidden
          />

          <div className="grid gap-5 md:grid-cols-5 md:gap-3">
            {FLOW_STEPS.map((step, i) => (
              <div key={step.label} data-flow-step className="group relative">
                <div className="mb-4 flex items-center gap-3 md:mb-5 md:flex-col md:gap-0">
                  <div
                    data-flow-node
                    className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black font-mono text-[11px] text-white/70 shadow-[0_0_24px_rgba(255,255,255,0.06)] transition-colors duration-300 group-hover:border-white/45 group-hover:text-white"
                  >
                    {String(i + 1).padStart(2, "0")}
                    <span className="absolute inset-0 rounded-full bg-white/[0.04] opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  {i < FLOW_STEPS.length - 1 && (
                    <div className="h-px flex-1 bg-white/10 md:hidden" aria-hidden />
                  )}
                </div>

                <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 backdrop-blur-sm transition-colors duration-300 group-hover:border-white/20 group-hover:from-white/[0.08]">
                  <span
                    className="pointer-events-none absolute -right-1 -top-2 font-display text-6xl font-bold leading-none text-white/[0.04]"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
                    {STEP_TAGS[i]}
                  </p>
                  <p className="mt-3 font-display text-lg font-semibold leading-tight">
                    {step.label}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-white/45">{step.sub}</p>
                </article>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
