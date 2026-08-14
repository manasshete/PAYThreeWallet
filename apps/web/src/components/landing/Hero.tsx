"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import Image from "next/image";
import { useRef } from "react";
import { FeaturePanel } from "./FeaturePanel";
import { CommandTicker } from "./CommandTicker";
import { PixelField } from "./PixelField";
import { PixelLogo } from "./PixelLogo";
import { useSiteRevealed } from "./site-revealed";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const revealed = useSiteRevealed();

  useGSAP(
    () => {
      if (!revealed) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" }, delay: 0.05 });

      tl.from("[data-hero-eyebrow]", { y: 20, opacity: 0, duration: 0.6, immediateRender: false })
        .from(
          "[data-hero-line]",
          { y: 60, opacity: 0, duration: 0.8, stagger: 0.12, immediateRender: false },
          "-=0.3"
        )
        .from("[data-hero-body]", { y: 24, opacity: 0, duration: 0.7, immediateRender: false }, "-=0.4")
        .from("[data-hero-cta]", { y: 16, opacity: 0, duration: 0.6, immediateRender: false }, "-=0.3")
        .from("[data-hero-visual]", { y: 24, opacity: 0, duration: 0.8, immediateRender: false }, "-=0.3");

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduced) {
        gsap.to("[data-hero-watermark]", {
          x: -60,
          duration: 30,
          repeat: -1,
          ease: "none",
        });
      }
    },
    { scope: sectionRef, dependencies: [revealed] }
  );

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[100dvh] flex-col justify-center overflow-hidden bg-black"
    >
      <PixelField />

      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_35%,rgba(255,255,255,0.07),transparent_55%)]"
        aria-hidden
      />

      <div
        data-hero-watermark
        className="pointer-events-none absolute -bottom-12 left-0 flex gap-16 opacity-[0.04]"
        aria-hidden
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Image
            key={i}
            src="/pay3-logo.png"
            alt=""
            width={256}
            height={256}
            className="h-48 w-48 object-contain md:h-64 md:w-64"
          />
        ))}
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-8 px-6 py-24 md:grid-cols-2 md:gap-10 md:px-12 md:py-28">
        <div className="z-10 max-w-xl">
          <p
            data-hero-eyebrow
            className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-white/40"
          >
            AI-native finance on Stellar
          </p>

          <h1 className="font-display text-[clamp(2.25rem,5.5vw,4rem)] font-bold leading-[1.05] tracking-tight">
            <span data-hero-line className="block">
              Delegate.
            </span>
            <span data-hero-line className="block">
              Validate.
            </span>
            <span data-hero-line className="block">
              Execute.
            </span>
          </h1>

          <p
            data-hero-body
            className="mt-4 max-w-md text-base leading-relaxed text-white/55 md:mt-5 md:text-lg"
          >
            Pay3 is the MCP server that lets AI assistants manage wallets, run
            DeFi, and settle payments on Stellar — inside programmable policies,
            without ever touching your private key.
          </p>

          <div data-hero-cta className="mt-6 flex flex-wrap items-center gap-4">
            <a href="/dashboard?connect=freighter" className="btn-primary">
              Get Started
            </a>
            <span className="text-sm text-white/35">Claude · Cursor · ChatGPT</span>
          </div>

          <CommandTicker />
        </div>

        <div data-hero-visual className="relative z-10 w-full md:max-w-md md:justify-self-end">
          <div className="mx-auto w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 backdrop-blur-sm sm:max-w-sm md:max-w-none md:p-4">
            <div className="flex h-40 w-full items-center justify-center py-2 md:h-44">
              <PixelLogo pixelSize={7} interactive idle compact skipEntrance />
            </div>

            <div className="mt-2.5 border-t border-white/10 pt-3">
              <FeaturePanel screen="flow" embedded className="max-w-none" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
