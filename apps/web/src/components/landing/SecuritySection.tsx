"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "@/lib/gsap";
import { useRef } from "react";
import { Pay3Logo } from "@/components/ui/Logo";
import { NAV_LINKS } from "@/lib/content";

const SECURITY_ITEMS = [
  { deny: true, text: "Cannot access the private key" },
  { deny: true, text: "Cannot exceed spending limits" },
  { deny: true, text: "Cannot use unknown contracts" },
  { deny: true, text: "Cannot transfer outside policies" },
  { deny: false, text: "Can only execute approved actions" },
] as const;

export function SecuritySection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-security-item]", {
        x: -20,
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "power2.out",
        scrollTrigger: { trigger: sectionRef.current, start: "top 70%" },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="bg-pay3-gray-900 py-24 md:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 md:grid-cols-2 md:px-12">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/35">
            Security first
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-5xl">
            The AI proposes.
            <br />
            Your policy decides.
          </h2>
          <p className="mt-4 max-w-md text-white/50">
            Every transaction is validated before execution. Session keys expire.
            Limits are enforced on-chain through Soroban custom authentication.
          </p>
        </div>

        <ul className="space-y-3">
          {SECURITY_ITEMS.map((item) => (
            <li
              key={item.text}
              data-security-item
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                  item.deny
                    ? "bg-red-500/15 text-red-400"
                    : "bg-white/10 text-white/80"
                }`}
              >
                {item.deny ? "✕" : "✓"}
              </span>
              <span className="text-sm text-white/70">{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/8 bg-black py-14">
      <div className="mx-auto max-w-7xl px-6 md:px-12">
        <div className="flex flex-col items-center justify-between gap-10 md:flex-row md:items-start">
          <div className="flex flex-col items-center md:items-start">
            <Pay3Logo size={40} className="h-10 w-10 opacity-90" />
            <p className="mt-4 max-w-xs text-center text-sm text-white/40 md:text-left">
              MCP-powered AI financial infrastructure on Stellar.
            </p>
          </div>

          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3" aria-label="Footer">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="text-sm text-white/50 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <a href="/guide/getting-started" className="btn-primary shrink-0 text-sm">
            Getting started
          </a>
        </div>

        <p className="mt-12 text-center text-xs text-white/25 md:text-left">
          © {year} Pay3. Built on Stellar · Soroban · MCP.
        </p>
      </div>
    </footer>
  );
}
