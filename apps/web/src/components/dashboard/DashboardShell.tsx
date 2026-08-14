"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DASHBOARD_NAV } from "@pay3/shared";
import { Pay3Logo } from "@/components/ui/Logo";
import { IS_MAINNET } from "@/lib/network";
import { truncateKey } from "@/lib/wallet";
import { DashboardReveal } from "./DashboardReveal";

type DashboardShellProps = {
  publicKey?: string;
  onLogout?: () => void;
  children: React.ReactNode;
};

const PRIMARY = new Set([
  "/dashboard",
  "/dashboard/contacts",
  "/dashboard/sessions",
  "/dashboard/approvals",
  "/dashboard/history",
]);

function NavDivider() {
  return (
    <span
      className="mx-1.5 hidden h-6 w-px shrink-0 bg-white/15 lg:block"
      aria-hidden
    />
  );
}

export function DashboardShell({
  publicKey,
  onLogout,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const primary = DASHBOARD_NAV.filter((item) => PRIMARY.has(item.href));
  const secondary = DASHBOARD_NAV.filter((item) => !PRIMARY.has(item.href));
  const moreActive = secondary.some((item) =>
    item.href === "/guide"
      ? pathname.startsWith("/guide")
      : pathname.startsWith(item.href)
  );

  useEffect(() => {
    setMoreOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onDoc(e: MouseEvent) {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/guide") return pathname.startsWith("/guide");
    return pathname.startsWith(href);
  }

  return (
    <div className="dash-shell dash-shell-bg relative min-h-screen overflow-x-hidden text-white">
      <div className="dash-shell-dots pointer-events-none absolute inset-0" aria-hidden />
      <div className="dash-shell-noise pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-[28%] h-[520px] w-[min(900px,90vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.08),transparent_65%)] blur-2xl"
        aria-hidden
      />

      <header className="dash-header sticky top-0 z-40 flex justify-center px-4 pt-5 md:px-8 md:pt-6">
        <div className="glass-nav flex w-full max-w-6xl items-center gap-2 rounded-full border border-white/[0.1] px-3.5 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:gap-3 sm:px-5 sm:py-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 rounded-full px-2 text-white transition-opacity duration-300 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <Pay3Logo size={40} priority className="h-10 w-10" />
            <span className="hidden font-[family-name:var(--font-space-grotesk)] text-[17px] font-semibold tracking-tight sm:inline">
              Pay3
            </span>
          </Link>

          <NavDivider />

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
            aria-label="Dashboard"
          >
            {primary.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    active
                      ? "text-white"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            <div className="relative" ref={moreRef}>
              <button
                type="button"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                onClick={() => setMoreOpen((v) => !v)}
                className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-[15px] font-medium transition-colors duration-300 ${
                  moreActive || moreOpen
                    ? "text-white"
                    : "text-white/55 hover:text-white"
                }`}
              >
                More
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  aria-hidden
                  className={`opacity-50 transition-transform duration-300 ${moreOpen ? "rotate-180" : ""}`}
                >
                  <path
                    d="M2 3.5 L5 6.5 L8 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              {moreOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-[12rem] overflow-hidden rounded-2xl border border-white/10 bg-[#121214]/96 p-1 shadow-[0_24px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl"
                >
                  {secondary.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        className={`block rounded-xl px-3.5 py-2.5 text-[15px] transition-colors ${
                          active
                            ? "bg-white/10 text-white"
                            : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                  <a
                    href="https://pay3.mintlify.site"
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    className="mt-0.5 block rounded-xl border-t border-white/[0.06] px-3.5 py-2.5 text-[15px] text-white/55 hover:bg-white/[0.06] hover:text-white"
                  >
                    Docs ↗
                  </a>
                </div>
              ) : null}
            </div>
          </nav>

          <NavDivider />

          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <span
              className={`hidden items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] sm:inline-flex ${
                IS_MAINNET
                  ? "border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-200/90"
                  : "border-white/10 bg-black/40 text-white/80"
              }`}
            >
              {IS_MAINNET ? "Mainnet" : "Testnet"}
            </span>
            {publicKey ? (
              <div className="hidden items-center rounded-full border border-white/[0.12] px-3.5 py-2 text-[13px] text-white/80 sm:flex">
                Connected ·{" "}
                <span className="ml-1 font-[family-name:var(--font-jetbrains-mono)]">
                  {truncateKey(publicKey)}
                </span>
              </div>
            ) : null}
            {publicKey && onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="hidden rounded-full border border-white/10 bg-black/40 px-3.5 py-2 text-[13px] text-white/55 transition-[color,background,border-color,transform] duration-300 hover:border-white/20 hover:bg-white/[0.07] hover:text-white active:scale-[0.97] sm:inline-flex"
              >
                Log out
              </button>
            ) : null}
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              <div className="flex flex-col gap-1">
                <span
                  className={`block h-0.5 w-4 bg-white transition-transform ${menuOpen ? "translate-y-1.5 rotate-45" : ""}`}
                />
                <span
                  className={`block h-0.5 w-4 bg-white transition-opacity ${menuOpen ? "opacity-0" : ""}`}
                />
                <span
                  className={`block h-0.5 w-4 bg-white transition-transform ${menuOpen ? "-translate-y-1.5 -rotate-45" : ""}`}
                />
              </div>
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            className="absolute left-4 right-4 top-[calc(100%+8px)] mx-auto max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-xl lg:hidden"
            aria-label="Dashboard mobile"
          >
            <div className="flex flex-col gap-1">
              {DASHBOARD_NAV.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/75 hover:bg-white/[0.06] hover:text-white"
                    }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <a
                href="https://pay3.mintlify.site"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                Docs ↗
              </a>
              {publicKey ? (
                <div className="mt-2 rounded-xl border border-white/10 px-3 py-2.5 font-[family-name:var(--font-jetbrains-mono)] text-[12px] text-white/70">
                  Connected · {truncateKey(publicKey)}
                </div>
              ) : null}
              {publicKey && onLogout ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="mt-1 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  Log out
                </button>
              ) : null}
            </div>
          </nav>
        ) : null}
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-6 md:py-8">
        <DashboardReveal>{children}</DashboardReveal>
      </main>
    </div>
  );
}
