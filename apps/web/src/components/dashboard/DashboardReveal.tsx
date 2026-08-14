"use client";

import { useGSAP } from "@gsap/react";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { gsap } from "@/lib/gsap";

/** Soft page enter with sheet lift + section stagger. Always ends visible. */
export function DashboardReveal({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const sheets = el.querySelectorAll<HTMLElement>("[data-dash-reveal]");
      const blocks = el.querySelectorAll<HTMLElement>("[data-overview-block]");

      if (reduced) {
        gsap.set([...sheets, ...blocks], { clearProps: "all", opacity: 1, y: 0, scale: 1 });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (sheets.length) {
        tl.fromTo(
          sheets,
          { opacity: 0, y: 20, scale: 0.985 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            stagger: 0.05,
            clearProps: "transform",
          },
          0
        );
      }

      if (blocks.length) {
        tl.fromTo(
          blocks,
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
            stagger: 0.09,
            clearProps: "transform",
          },
          sheets.length ? "-=0.5" : 0
        );
      }

      if (!sheets.length && !blocks.length) {
        gsap.fromTo(
          el,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.65, ease: "power3.out" }
        );
      }
    },
    { scope: root, dependencies: [pathname] }
  );

  return (
    <div ref={root} className="dash-page" key={pathname}>
      {children}
    </div>
  );
}
