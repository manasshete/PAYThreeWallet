"use client";

import { useEffect, useRef, useState } from "react";
import { extractLogoPixels } from "@/lib/pixel-logo";
import { ScrollTrigger } from "@/lib/gsap";
import { PixelLoader } from "./PixelLoader";
import { SiteRevealedCtx } from "./site-revealed";

export function LoadingGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    document.body.style.overflow = "";
    setReady(true);
  };

  useEffect(() => {
    void extractLogoPixels("/pay3-logo.png");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      finish();
      setRevealed(true);
      return;
    }

    document.body.style.overflow = "hidden";
    const fallback = window.setTimeout(() => {
      setRevealed(true);
      finish();
    }, 3200);

    return () => {
      window.clearTimeout(fallback);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!revealed) return;
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [revealed]);

  return (
    <SiteRevealedCtx.Provider value={revealed}>
      {!ready && (
        <PixelLoader
          onReveal={() => setRevealed(true)}
          onDone={finish}
        />
      )}
      <div
        className="transition-opacity duration-500 ease-out"
        style={{
          opacity: revealed ? 1 : 0,
          pointerEvents: revealed ? "auto" : "none",
        }}
      >
        {children}
      </div>
    </SiteRevealedCtx.Provider>
  );
}
