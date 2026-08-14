"use client";

import { useEffect, useRef } from "react";
import { useSiteRevealed } from "./site-revealed";

type Bit = { x: number; y: number; vx: number; vy: number; size: number; alpha: number };

export function PixelField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const revealed = useSiteRevealed();

  useEffect(() => {
    if (!revealed) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let bits: Bit[] = [];
    let raf = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      bits = Array.from({ length: 36 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: Math.random() > 0.7 ? 3 : 2,
        alpha: Math.random() * 0.12 + 0.03,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const b of bits) {
        if (!reduced) {
          b.x += b.vx;
          b.y += b.vy;
          if (b.x < 0) b.x = canvas.width;
          if (b.x > canvas.width) b.x = 0;
          if (b.y < 0) b.y = canvas.height;
          if (b.y > canvas.height) b.y = 0;
        }
        ctx.fillStyle = `rgba(255,255,255,${b.alpha})`;
        ctx.fillRect(b.x, b.y, b.size, b.size);
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [revealed]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-80"
      aria-hidden
    />
  );
}
