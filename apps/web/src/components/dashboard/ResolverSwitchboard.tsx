"use client";

import { useGSAP } from "@gsap/react";
import { useMemo, useRef } from "react";
import type { ContactView } from "@pay3/shared";
import { truncateKey } from "@/lib/wallet";
import { gsap } from "@/lib/gsap";

export type ResolverPipelineState = "idle" | "scanning" | "pass" | "block";

type ResolverSwitchboardProps = {
  state: ResolverPipelineState;
  query?: string;
  output?: string | null;
  contacts: ContactView[];
  matchedContactId?: string | null;
  compact?: boolean;
  hero?: boolean;
};

function StellarBadgeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.1" />
      <path
        d="M7 3.5 8.2 6.8H11.5L8.9 8.7 9.8 12 7 10.1 4.2 12 5.1 8.7 2.5 6.8H5.8L7 3.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function VerifiedIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="5.5" fill="currentColor" fillOpacity="0.18" />
      <path
        d="M3.5 6 5.2 7.7 8.5 4.3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ResolverSwitchboard({
  state,
  query,
  output,
  contacts,
  matchedContactId,
  compact = false,
  hero = false,
}: ResolverSwitchboardProps) {
  const root = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const visual = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLDivElement>(null);
  const floaters = useRef<HTMLDivElement>(null);
  const core = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  const outputLabel = output ? truncateKey(output) : "G…";
  const queryLabel = query?.trim() || "speak a name";
  const visibleContacts = contacts.slice(0, hero ? 4 : compact ? 3 : 4);

  const matched = useMemo(
    () => contacts.find((c) => c.id === matchedContactId) ?? null,
    [contacts, matchedContactId]
  );

  const heroLetter = (
    matched?.name ??
    query?.trim() ??
    visibleContacts[0]?.name ??
    "?"
  )
    .charAt(0)
    .toUpperCase();

  const statusLabel =
    state === "block"
      ? "Blocked"
      : state === "pass"
        ? "Locked"
        : state === "scanning"
          ? "Resolving"
          : "Standby";

  useGSAP(
    () => {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      gsap.killTweensOf([
        card.current,
        visual.current,
        badge.current,
        core.current,
        ring.current,
        floaters.current?.children,
      ]);

      if (card.current && !reduced) {
        gsap.fromTo(
          card.current,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }
        );
      }

      if (reduced) return;

      if (floaters.current?.children.length) {
        gsap.to(floaters.current.children, {
          y: "+=5",
          rotation: "+=4",
          duration: 2.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          stagger: { each: 0.4, from: "random" },
        });
      }

      if (state === "idle") {
        if (ring.current) gsap.set(ring.current, { rotation: 0, opacity: 0.35 });
        if (visual.current) gsap.to(visual.current, { filter: "brightness(1)", duration: 0.4 });
        return;
      }

      if (state === "scanning") {
        if (ring.current) {
          gsap.to(ring.current, {
            rotation: 360,
            duration: 3,
            repeat: -1,
            ease: "none",
          });
          gsap.to(ring.current, { opacity: 0.75, duration: 0.3 });
        }
        if (visual.current) {
          gsap.to(visual.current, {
            filter: "brightness(1.06)",
            duration: 0.4,
            repeat: -1,
            yoyo: true,
          });
        }
        return;
      }

      if (state === "pass") {
        if (ring.current) gsap.to(ring.current, { opacity: 0, duration: 0.25 });
        if (badge.current) {
          gsap.fromTo(
            badge.current,
            { scale: 0.92, y: 4 },
            { scale: 1, y: 0, duration: 0.55, ease: "back.out(2)" }
          );
        }
        if (core.current) {
          gsap.fromTo(
            core.current,
            { scale: 0.94 },
            { scale: 1, duration: 0.5, ease: "back.out(1.8)" }
          );
        }
        return;
      }

      if (state === "block" && card.current) {
        if (ring.current) gsap.to(ring.current, { opacity: 0, duration: 0.2 });
        gsap.to(card.current, {
          x: -3,
          duration: 0.05,
          repeat: 5,
          yoyo: true,
          onComplete: () => gsap.set(card.current, { x: 0 }),
        });
      }
    },
    { scope: root, dependencies: [state, matchedContactId] }
  );

  const visualTone =
    state === "pass"
      ? "resolver-tone-pass"
      : state === "block"
        ? "resolver-tone-block"
        : state === "scanning"
          ? "resolver-tone-scan"
          : "resolver-tone-idle";

  const pillTone =
    state === "pass"
      ? "bg-emerald-400 text-black shadow-[0_0_20px_rgba(52,211,153,0.25)]"
      : state === "block"
        ? "bg-red-400/95 text-black"
        : state === "scanning"
          ? "bg-violet-400 text-black shadow-[0_0_20px_rgba(168,85,247,0.25)]"
          : "bg-white text-black";

  if (!hero && !compact) {
    return (
      <div ref={root} className="resolver-board px-6 py-7 md:px-10" data-overview-block>
        <ResolverSwitchboard
          state={state}
          query={query}
          output={output}
          contacts={contacts}
          matchedContactId={matchedContactId}
          compact
        />
      </div>
    );
  }

  return (
    <div
      ref={root}
      className={hero ? "resolver-board-hero" : "mt-3"}
      data-overview-block={hero ? true : undefined}
    >
      <div
        ref={card}
        className={`resolver-card group relative rounded-[1.4rem] border border-white/[0.08] bg-[#0b0b0d] p-[1px] shadow-[0_24px_60px_rgba(0,0,0,0.45)] ${
          compact ? "max-w-sm" : ""
        }`}
      >
        <div className="resolver-card-shine pointer-events-none absolute inset-0 rounded-[1.4rem]" aria-hidden />

        <div className="overflow-hidden rounded-[1.35rem] bg-[#0c0c0e]">
          <div
            ref={visual}
            className={`resolver-card-visual relative ${visualTone} ${
              hero ? "h-[12.5rem]" : "h-[8rem]"
            }`}
          >
            <div className="resolver-card-grid absolute inset-0" aria-hidden />
            <div className="resolver-card-vignette absolute inset-0" aria-hidden />
            <div className="resolver-card-aurora absolute inset-0" aria-hidden />

            <div ref={floaters} className="resolver-box-field absolute inset-0" aria-hidden>
              <div className="resolver-box absolute left-[8%] top-[12%] h-9 w-9 rotate-[14deg]" />
              <div className="resolver-box resolver-box-violet absolute right-[10%] top-[14%] h-6 w-6 -rotate-[8deg]" />
              <div className="resolver-box resolver-box-emerald absolute left-[18%] bottom-[20%] h-5 w-5 rotate-[38deg]" />
              <div className="resolver-box absolute right-[16%] bottom-[22%] h-7 w-7 -rotate-[16deg]" />
              <div className="resolver-box resolver-box-dim absolute left-[42%] top-[8%] h-4 w-4 rotate-[22deg]" />
              <div className="resolver-box resolver-box-dim absolute right-[32%] bottom-[10%] h-3.5 w-3.5 rotate-[-28deg]" />
            </div>

            {visibleContacts.map((c, i) => {
              const positions = [
                "left-[7%] top-[40%]",
                "right-[8%] top-[36%]",
                "left-[14%] bottom-[16%]",
                "right-[12%] bottom-[18%]",
              ];
              const live =
                matchedContactId === c.id &&
                (state === "pass" || state === "scanning");
              return (
                <div
                  key={c.id}
                  className={`absolute ${positions[i]} flex h-8 w-8 items-center justify-center rounded-full border font-[family-name:var(--font-space-grotesk)] text-[10px] font-semibold uppercase backdrop-blur-sm transition-all duration-500 ${
                    live
                      ? "scale-110 border-violet-400/45 bg-violet-500/15 text-white shadow-[0_0_18px_rgba(168,85,247,0.3)]"
                      : "border-white/10 bg-black/35 text-white/65"
                  } ${live && state === "scanning" ? "animate-pulse" : ""}`}
                >
                  {c.name.charAt(0)}
                </div>
              );
            })}

            <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2">
              <div
                ref={ring}
                className={`resolver-scan-ring absolute left-1/2 top-1/2 rounded-full border border-dashed border-white/10 ${
                  hero ? "h-[6.5rem] w-[6.5rem] -translate-x-1/2 -translate-y-1/2" : "h-20 w-20 -translate-x-1/2 -translate-y-1/2"
                }`}
                aria-hidden
              />
              <div
                ref={core}
                className={`relative flex items-center justify-center rounded-[1.15rem] border font-[family-name:var(--font-space-grotesk)] font-semibold uppercase backdrop-blur-sm transition-all duration-500 ${
                  hero ? "h-[4.75rem] w-[4.75rem] text-[2rem]" : "h-14 w-14 text-xl"
                } ${
                  state === "pass"
                    ? "border-emerald-400/35 bg-emerald-500/[0.12] text-emerald-100 shadow-[0_0_48px_rgba(52,211,153,0.18)]"
                    : state === "block"
                      ? "border-red-400/30 bg-red-500/[0.08] text-red-200"
                      : "border-white/12 bg-white/[0.04] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                }`}
              >
                {heroLetter}
              </div>
            </div>
          </div>

          <div className="relative z-10 -mt-5 flex justify-center px-5">
            <div
              ref={badge}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-colors duration-500 ${
                state === "pass"
                  ? "border-emerald-400/25 bg-[#0a100d]/95"
                  : state === "block"
                    ? "border-red-400/20 bg-[#100909]/95"
                    : "border-white/10 bg-[#101012]/95"
              }`}
            >
              <span className="text-white/45">
                <StellarBadgeIcon />
              </span>
              <span
                className={`font-[family-name:var(--font-jetbrains-mono)] text-[11px] tracking-wide ${
                  state === "pass"
                    ? "text-emerald-300/95"
                    : state === "block"
                      ? "text-red-300/90"
                      : "text-white/70"
                }`}
              >
                {state === "pass" && output ? truncateKey(output) : "G…"}
              </span>
            </div>
          </div>

          <div className={`${hero ? "px-5 pb-5 pt-4" : "px-4 pb-4 pt-3"}`}>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.14em] text-white/30">
                    Resolver
                  </span>
                  {state === "pass" && matched ? (
                    <>
                      <span className="text-white/20">·</span>
                      <span className="truncate font-[family-name:var(--font-space-grotesk)] text-[12px] text-white/70">
                        {matched.name}
                      </span>
                      <span className="text-emerald-400/90">
                        <VerifiedIcon />
                      </span>
                    </>
                  ) : null}
                </div>

                <p
                  className={`mt-1.5 truncate font-[family-name:var(--font-space-grotesk)] font-semibold tracking-[-0.03em] text-white ${
                    hero ? "text-[1.5rem] leading-[1.1]" : "text-xl leading-tight"
                  }`}
                >
                  {state === "pass" && outputLabel !== "G…"
                    ? outputLabel
                    : queryLabel}
                </p>

                <p
                  className={`mt-2 max-w-[16rem] font-[family-name:var(--font-jetbrains-mono)] text-[10px] leading-relaxed ${
                    state === "pass"
                      ? "text-emerald-400/65"
                      : state === "block"
                        ? "text-red-400/65"
                        : "text-white/28"
                  }`}
                >
                  {state === "pass"
                    ? "Exact match — payment may proceed"
                    : state === "block"
                      ? "Blocked — ambiguous or unknown"
                      : state === "scanning"
                        ? "Sweeping saved contacts…"
                        : "One name, one address — never guesses"}
                </p>

                {visibleContacts.length > 0 ? (
                  <div className="mt-3 flex -space-x-1.5">
                    {visibleContacts.slice(0, 4).map((c) => (
                      <span
                        key={c.id}
                        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0c0c0e] text-[8px] font-semibold uppercase ${
                          matchedContactId === c.id && state === "pass"
                            ? "bg-emerald-400/20 text-emerald-200"
                            : "bg-white/[0.07] text-white/55"
                        }`}
                        title={c.name}
                      >
                        {c.name.charAt(0)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-stretch">
                <span
                  className={`inline-flex items-center rounded-l-full px-4 py-2.5 font-[family-name:var(--font-space-grotesk)] text-[11px] font-semibold tracking-[-0.01em] transition-all duration-300 ${pillTone}`}
                >
                  {statusLabel}
                </span>
                <span
                  className={`flex w-9 items-center justify-center rounded-r-full border-l border-black/10 font-[family-name:var(--font-jetbrains-mono)] text-[10px] ${pillTone}`}
                >
                  {state === "pass" ? "✓" : state === "block" ? "✕" : "◎"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
