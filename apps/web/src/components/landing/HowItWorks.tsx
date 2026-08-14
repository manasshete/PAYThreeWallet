"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { useRef } from "react";
import { HOW_IT_WORKS } from "@/lib/content";
import { FeaturePanel, type PanelScreen } from "./FeaturePanel";

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-how-title]", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: { trigger: sectionRef.current, start: "top 80%" },
      });

      gsap.utils.toArray<HTMLElement>("[data-how-card]").forEach((card, i) => {
        gsap.from(card, {
          y: 50,
          opacity: 0,
          duration: 0.7,
          delay: i * 0.1,
          ease: "power3.out",
          scrollTrigger: { trigger: card, start: "top 85%" },
        });
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="section-light py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <h2
          data-how-title
          className="text-center font-display text-4xl font-bold tracking-tight md:text-5xl"
        >
          Connect Pay3 in three steps
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-black/45">
          From MCP config to live Stellar transactions — under a minute.
        </p>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <article
              key={item.step}
              data-how-card
              className="flex flex-col rounded-3xl border border-black/8 bg-white p-6 shadow-sm md:p-8"
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-sm text-black/40">{item.step}</span>
                {"badge" in item && item.badge && (
                  <span className="rounded-full bg-black px-3 py-1 text-[10px] font-medium text-white">
                    {item.badge}
                  </span>
                )}
              </div>

              <h3 className="mt-6 font-display text-xl font-bold leading-snug text-black md:text-2xl">
                {item.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-black/55">
                {item.description}
              </p>

              <div className="mt-8 flex flex-1 items-end">
                <FeaturePanel screen={item.screen as PanelScreen} className="max-w-none" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
