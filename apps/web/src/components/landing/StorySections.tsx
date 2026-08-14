"use client";

import { useGSAP } from "@gsap/react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useRef, useState } from "react";
import { STORY_SECTIONS } from "@/lib/content";
import { FeaturePanel, type PanelScreen } from "./FeaturePanel";
import { useSiteRevealed } from "./site-revealed";

function MobileStories() {
  const ref = useRef<HTMLDivElement>(null);
  const revealed = useSiteRevealed();

  useGSAP(
    () => {
      if (!revealed) return;

      gsap.utils.toArray<HTMLElement>("[data-story-mobile]").forEach((block) => {
        gsap.from(block, {
          autoAlpha: 0,
          y: 32,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: block, start: "top 85%" },
        });
      });
    },
    { scope: ref, dependencies: [revealed] }
  );

  return (
    <div ref={ref} className="space-y-16 px-6 pb-24 md:hidden">
      {STORY_SECTIONS.map((section, i) => (
        <article
          key={section.id}
          data-story-mobile
          className="border-t border-white/8 pt-12"
        >
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/35">
            {section.eyebrow}
          </p>
          <h3 className="mt-4 font-display text-2xl font-bold leading-tight">{section.title}</h3>
          <p className="mt-4 text-base leading-relaxed text-white/55">{section.body}</p>
          <a href="#how-it-works" className="btn-ghost mt-6 inline-flex text-sm">
            {section.cta}
          </a>
          <div className="mt-8 flex justify-center">
            <FeaturePanel screen={section.screen as PanelScreen} className="max-w-sm" />
          </div>
          <p className="mt-4 text-center font-mono text-[10px] text-white/25">
            {String(i + 1).padStart(2, "0")} / {String(STORY_SECTIONS.length).padStart(2, "0")}
          </p>
        </article>
      ))}
    </div>
  );
}

function DesktopStories() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const revealed = useSiteRevealed();

  useGSAP(
    () => {
      if (!revealed) return;

      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        const container = containerRef.current;
        const pin = pinRef.current;
        if (!container || !pin) return;

        const total = STORY_SECTIONS.length;

        const st = ScrollTrigger.create({
          trigger: container,
          start: "top top",
          end: () => `+=${(total - 1) * window.innerHeight * 0.9}`,
          pin,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          scrub: 0.5,
          snap: {
            snapTo: 1 / (total - 1),
            duration: { min: 0.2, max: 0.35 },
            delay: 0.05,
            ease: "power2.inOut",
          },
          onUpdate: (self) => {
            const index = Math.min(
              total - 1,
              Math.max(0, Math.round(self.progress * (total - 1)))
            );
            if (index !== activeRef.current) {
              activeRef.current = index;
              setActive(index);
            }
          },
        });

        requestAnimationFrame(() => ScrollTrigger.refresh());

        return () => st.kill();
      });

      return () => mm.revert();
    },
    { scope: containerRef, dependencies: [revealed] }
  );

  useGSAP(
    () => {
      if (!revealed) return;

      gsap
        .timeline()
        .fromTo(
          textRef.current,
          { autoAlpha: 0, y: 20 },
          { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" }
        )
        .fromTo(
          visualRef.current,
          { autoAlpha: 0, y: 16, scale: 0.98 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: "power2.out" },
          "-=0.2"
        );
    },
    { scope: containerRef, dependencies: [active, revealed], revertOnUpdate: true }
  );

  const section = STORY_SECTIONS[active];

  return (
    <div ref={containerRef} className="hidden md:block">
      <div
        ref={pinRef}
        className="isolate flex min-h-screen flex-col justify-center bg-black py-16 md:py-24"
      >
        <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 md:grid-cols-2 md:px-12">
          <div>
            <div ref={textRef} className="min-h-[260px] md:min-h-[280px]">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/35">
                {section.eyebrow}
              </p>
              <h3 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight md:text-5xl">
                {section.title}
              </h3>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-white/55">
                {section.body}
              </p>
              <a href="#how-it-works" className="btn-ghost mt-8 w-fit">
                {section.cta}
              </a>
            </div>

            <div className="mt-8 flex gap-2" role="tablist" aria-label="Feature progress">
              {STORY_SECTIONS.map((s, i) => (
                <span
                  key={s.id}
                  role="tab"
                  aria-selected={i === active}
                  aria-label={s.title}
                  className="h-1 w-8 rounded-full transition-colors duration-300"
                  style={{
                    backgroundColor:
                      i === active ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>
          </div>

          <div ref={visualRef} className="flex justify-center md:justify-end">
            <FeaturePanel screen={section.screen as PanelScreen} className="max-w-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function StorySections() {
  const containerRef = useRef<HTMLDivElement>(null);
  const revealed = useSiteRevealed();

  useGSAP(
    () => {
      if (!revealed) return;

      gsap.from("[data-features-intro]", {
        autoAlpha: 0,
        y: 30,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: {
          trigger: "[data-features-intro]",
          start: "top 82%",
        },
      });
    },
    { scope: containerRef, dependencies: [revealed] }
  );

  return (
    <div id="features" ref={containerRef} className="relative bg-black">
      <div
        data-features-intro
        className="mx-auto max-w-7xl px-6 py-20 md:px-12 md:py-28"
      >
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/35">
          Platform capabilities
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-5xl">
          Everything your AI agent needs to operate on Stellar
        </h2>
      </div>

      <DesktopStories />
      <MobileStories />
    </div>
  );
}
