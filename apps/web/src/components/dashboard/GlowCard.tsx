"use client";

import type { ReactNode } from "react";

type GlowCardVariant = "amber" | "violet" | "cyan" | "slate" | "emerald";

const VARIANTS: Record<GlowCardVariant, string> = {
  amber:
    "glow-card-amber bg-gradient-to-br from-[#3d2a14] via-[#2a1a0c] to-[#120a04] shadow-[0_20px_50px_rgba(245,158,11,0.12)]",
  violet:
    "glow-card-violet bg-gradient-to-br from-[#2a1845] via-[#1a0f2e] to-[#0a0612] shadow-[0_20px_50px_rgba(168,85,247,0.14)]",
  cyan:
    "glow-card-cyan bg-gradient-to-br from-[#0f2a3d] via-[#0a1a28] to-[#040810] shadow-[0_20px_50px_rgba(34,211,238,0.1)]",
  emerald:
    "glow-card-emerald bg-gradient-to-br from-[#0f2d22] via-[#0a1f18] to-[#040a08] shadow-[0_20px_50px_rgba(52,211,153,0.12)]",
  slate:
    "glow-card-slate bg-gradient-to-br from-[#1c1c22] via-[#121216] to-[#08080a] shadow-[0_20px_50px_rgba(0,0,0,0.35)]",
};

type GlowCardProps = {
  variant: GlowCardVariant;
  icon: ReactNode;
  label: string;
  value: string;
  badge?: { text: string; tone?: "up" | "down" | "neutral" };
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  dataAttr?: string;
  children?: ReactNode;
};

export function GlowCard({
  variant,
  icon,
  label,
  value,
  badge,
  onClick,
  disabled,
  className = "",
  dataAttr,
  children,
}: GlowCardProps) {
  const Tag = onClick ? "button" : "div";
  const badgeTone =
    badge?.tone === "up"
      ? "text-emerald-200/90"
      : badge?.tone === "down"
        ? "text-rose-300/90"
        : "text-white/70";

  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      disabled={disabled}
      data-glow-card={dataAttr}
      className={`glow-card group relative w-full overflow-hidden rounded-[1.65rem] border border-white/[0.08] p-5 text-left transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.02] hover:border-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${VARIANTS[variant]} ${className}`}
    >
      <div className="glow-card-streak pointer-events-none absolute inset-0" aria-hidden />
      <div className="glow-card-noise pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden />

      <div className="relative flex h-full min-h-[9.5rem] flex-col">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur-sm transition-transform duration-500 group-hover:scale-110">
          {icon}
        </div>

        <p className="mt-auto pt-8 font-[family-name:var(--font-jetbrains-mono)] text-[10px] uppercase tracking-[0.18em] text-white/45">
          {label}
        </p>
        <p className="mt-1 font-[family-name:var(--font-space-grotesk)] text-[1.65rem] font-semibold leading-none tracking-[-0.03em] text-white">
          {value}
        </p>

        {badge ? (
          <span
            className={`mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-black/25 px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[10px] backdrop-blur-sm ${badgeTone}`}
          >
            {badge.text}
          </span>
        ) : null}

        {children}
      </div>
    </Tag>
  );
}

export function clientVariant(clientType: string): GlowCardVariant {
  switch (clientType) {
    case "claude":
      return "amber";
    case "cursor":
      return "violet";
    case "chatgpt":
      return "emerald";
    default:
      return "cyan";
  }
}
