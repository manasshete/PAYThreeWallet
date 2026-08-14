"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { extractLogoPixels, type PixelGrid } from "@/lib/pixel-logo";
import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const ORBIT_LABELS = ["MCP", "Stellar", "Soroban", "Policy", "Session Keys"] as const;

type PixelLogoProps = {
  pixelSize?: number;
  orbit?: boolean;
  interactive?: boolean;
  idle?: boolean;
  compact?: boolean;
  quick?: boolean;
  skipEntrance?: boolean;
  className?: string;
  onAssembled?: () => void;
  onFailed?: () => void;
};

export function PixelLogo({
  pixelSize = 6,
  orbit = false,
  interactive = false,
  idle = false,
  compact = false,
  quick = false,
  skipEntrance = false,
  className = "",
  onAssembled,
  onFailed,
}: PixelLogoProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<PixelGrid | null>(null);
  const callbacks = useRef({ onAssembled, onFailed });
  callbacks.current = { onAssembled, onFailed };

  useEffect(() => {
    extractLogoPixels("/pay3-logo.png")
      .then(setGrid)
      .catch(() => callbacks.current.onFailed?.());
  }, []);

  useGSAP(
    () => {
      if (!grid?.pixels.length) return;

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const pixels = rootRef.current?.querySelectorAll("[data-pixel]");
      if (!pixels?.length) {
        callbacks.current.onAssembled?.();
        return;
      }

      if (reduced || skipEntrance) {
        gsap.set(pixels, { opacity: 1, scale: 1, x: 0, y: 0, rotation: 0 });
        callbacks.current.onAssembled?.();
        if (idle && fieldRef.current) {
          gsap.to(fieldRef.current, {
            y: -6,
            duration: 2.8,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
          });
        }
        return;
      }

      const scatter = quick ? 72 : 120;
      gsap.from(pixels, {
        opacity: 0,
        scale: 0,
        x: () => gsap.utils.random(-scatter, scatter),
        y: () => gsap.utils.random(-scatter, scatter),
        rotation: () => gsap.utils.random(-90, 90),
        duration: quick ? 0.48 : 0.85,
        stagger: { amount: quick ? 0.42 : 1.2, from: "random" },
        ease: "power3.out",
        force3D: true,
        onComplete: () => {
          callbacks.current.onAssembled?.();
          if (idle && fieldRef.current) {
            gsap.to(fieldRef.current, {
              y: -6,
              duration: 2.8,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
            });
          }
        },
      });

      if (orbit) {
        gsap.to("[data-orbit-ring]", {
          rotation: 360,
          duration: 28,
          repeat: -1,
          ease: "none",
        });
        gsap.to("[data-orbit-label]", {
          rotation: -360,
          duration: 28,
          repeat: -1,
          ease: "none",
        });
      }

      gsap.to("[data-pixel-glow]", {
        opacity: 0.5,
        scale: 1.06,
        duration: 2.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: quick ? 0.35 : 1.4,
      });
    },
    { scope: rootRef, dependencies: [grid?.pixels.length, orbit, idle, quick, skipEntrance] }
  );

  const gap = 1;
  const cell = pixelSize;
  const fieldW = grid ? grid.cols * (cell + gap) : 0;
  const fieldH = grid ? grid.rows * (cell + gap) : 0;
  const showOrbit = Boolean(orbit && !compact && grid);
  const orbitR = showOrbit ? Math.max(fieldW, fieldH) * 0.45 + 28 : 0;
  const boxW = showOrbit ? fieldW + orbitR * 2 : fieldW;
  const boxH = showOrbit ? fieldH + orbitR * 2 : fieldH;

  const [fitScale, setFitScale] = useState(1);
  const fitScaleRef = useRef(1);

  useLayoutEffect(() => {
    if (!compact || !grid || boxW <= 0 || boxH <= 0) return;
    const parent = shellRef.current?.parentElement;
    if (!parent) return;

    const update = () => {
      const sx = (parent.clientWidth - 8) / boxW;
      const sy = (parent.clientHeight - 8) / boxH;
      const next = Math.min(1, sx, sy);
      fitScaleRef.current = next;
      setFitScale(next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [compact, grid, boxW, boxH]);

  useEffect(() => {
    if (!interactive || !grid) return;

    const bind = () => {
      const field = fieldRef.current;
      const target = compact ? shellRef.current ?? field : field;
      if (!field || !target) return;

      const gap = 1;
      const cell = pixelSize;
      const hitR = 90;

      const onMove = (e: MouseEvent) => {
        const rect = field.getBoundingClientRect();
        const scale = compact ? fitScaleRef.current : 1;
        const mx = (e.clientX - rect.left) / scale;
        const my = (e.clientY - rect.top) / scale;

        field.querySelectorAll<HTMLElement>("[data-pixel]").forEach((el) => {
          const px = Number(el.dataset.gx) * (cell + gap) + cell / 2;
          const py = Number(el.dataset.gy) * (cell + gap) + cell / 2;
          const dx = px - mx;
          const dy = py - my;
          const dist = Math.hypot(dx, dy);
          const push = dist < hitR ? ((hitR - dist) / hitR) * 10 : 0;
          const ox = dist > 0 ? (dx / dist) * push : 0;
          const oy = dist > 0 ? (dy / dist) * push : 0;
          gsap.to(el, { x: ox, y: oy, duration: 0.15, overwrite: "auto" });
        });
      };

      const onLeave = () => {
        field.querySelectorAll<HTMLElement>("[data-pixel]").forEach((el) => {
          gsap.to(el, { x: 0, y: 0, duration: 0.25, overwrite: "auto" });
        });
      };

      target.addEventListener("mousemove", onMove);
      target.addEventListener("mouseleave", onLeave);
      return () => {
        target.removeEventListener("mousemove", onMove);
        target.removeEventListener("mouseleave", onLeave);
      };
    };

    const cleanup = bind();
    if (cleanup) return cleanup;

    let unbind: (() => void) | undefined;
    const id = requestAnimationFrame(() => {
      unbind = bind() ?? undefined;
    });
    return () => {
      cancelAnimationFrame(id);
      unbind?.();
    };
  }, [interactive, grid, pixelSize, compact]);

  if (!grid) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <Image src="/pay3-logo.png" alt="" width={96} height={96} className="opacity-30" priority />
      </div>
    );
  }

  const logo = (
    <>
      <div
        data-pixel-glow
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.05] blur-3xl"
        style={{ width: fieldW * 1.8, height: fieldW * 1.8 }}
        aria-hidden
      />

      {showOrbit && (
        <div
          data-orbit-ring
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: boxW, height: boxH }}
          aria-hidden
        >
          {ORBIT_LABELS.map((label, i) => {
            const angle = (i / ORBIT_LABELS.length) * 360;
            return (
              <span
                key={label}
                data-orbit-label
                className="absolute left-1/2 top-1/2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/35"
                style={{
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${orbitR}px) rotate(${-angle}deg)`,
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      <div
        ref={fieldRef}
        className="relative z-10"
        style={{ width: fieldW, height: fieldH }}
        aria-label="Pay3"
        role="img"
      >
        {grid.pixels.map((p) => (
          <span
            key={p.id}
            data-pixel
            data-gx={p.gx}
            data-gy={p.gy}
            className="absolute block bg-white will-change-transform"
            style={{
              width: cell,
              height: cell,
              left: p.gx * (cell + gap),
              top: p.gy * (cell + gap),
            }}
          />
        ))}
      </div>
    </>
  );

  if (compact) {
    return (
      <div
        ref={shellRef}
        className={`relative mx-auto shrink-0 cursor-pointer ${className}`}
        style={{ width: boxW * fitScale, height: boxH * fitScale }}
      >
        <div
          ref={rootRef}
          className="absolute left-0 top-0 flex items-center justify-center"
          style={{
            width: boxW,
            height: boxH,
            transform: `scale(${fitScale})`,
            transformOrigin: "top left",
          }}
        >
          {logo}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`relative flex shrink-0 items-center justify-center ${className}`}
      style={{ width: boxW, height: boxH }}
    >
      {logo}
    </div>
  );
}
