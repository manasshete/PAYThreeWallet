"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import Image from "next/image";
import { useRef } from "react";
import { PixelLogo } from "./PixelLogo";

type PixelLoaderProps = {
  onDone: () => void;
  onReveal?: () => void;
};

function burstPixels(container: HTMLElement) {
  const pixels = container.querySelectorAll<HTMLElement>("[data-pixel]");
  if (!pixels.length) return;

  let maxGx = 0;
  let maxGy = 0;
  pixels.forEach((el) => {
    maxGx = Math.max(maxGx, Number(el.dataset.gx));
    maxGy = Math.max(maxGy, Number(el.dataset.gy));
  });
  const cx = maxGx / 2;
  const cy = maxGy / 2;

  gsap.to(pixels, {
    x: (_, el) => {
      const dx = Number(el.dataset.gx) - cx;
      const dy = Number(el.dataset.gy) - cy;
      const len = Math.hypot(dx, dy) || 1;
      return (dx / len) * gsap.utils.random(320, 520);
    },
    y: (_, el) => {
      const dx = Number(el.dataset.gx) - cx;
      const dy = Number(el.dataset.gy) - cy;
      const len = Math.hypot(dx, dy) || 1;
      return (dy / len) * gsap.utils.random(320, 520);
    },
    opacity: 0,
    scale: 0.5,
    duration: 0.5,
    stagger: { amount: 0.18, from: "center" },
    ease: "power3.in",
    force3D: true,
  });
}

export function PixelLoader({ onDone, onReveal }: PixelLoaderProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoWrapRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const revealRef = useRef(onReveal);
  revealRef.current = onReveal;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  const handleAssembled = () => {
    const tl = gsap.timeline({
      delay: 0.2,
      onComplete: finish,
    });

    tl.call(() => revealRef.current?.())
      .to("[data-loader-label]", { opacity: 0, y: 6, duration: 0.18, ease: "power2.in" }, 0)
      .to("[data-pixel-glow]", { opacity: 0, scale: 1.25, duration: 0.35, ease: "power2.in" }, 0)
      .add(() => {
        if (logoWrapRef.current) burstPixels(logoWrapRef.current);
      }, 0.02)
      .to(
        overlayRef.current,
        { opacity: 0, duration: 0.45, ease: "power2.inOut" },
        0.05
      );
  };

  useGSAP(
    () => {
      gsap.set(overlayRef.current, { opacity: 1 });
    },
    { scope: overlayRef }
  );

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black"
      aria-live="polite"
      aria-label="Loading Pay3"
    >
      <div ref={logoWrapRef}>
        <PixelLogo pixelSize={10} quick onAssembled={handleAssembled} onFailed={finish} />
      </div>
      <p
        data-loader-label
        className="mt-8 font-mono text-[10px] uppercase tracking-[0.3em] text-white/30"
      >
        Initializing MCP server
      </p>
      <Image
        src="/pay3-logo.png"
        alt=""
        width={1}
        height={1}
        className="sr-only"
        priority
      />
    </div>
  );
}
