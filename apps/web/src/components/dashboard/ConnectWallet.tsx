"use client";

import { useGSAP } from "@gsap/react";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import {
  claimQrLogin,
  classifyFreighterError,
  connectFreighter,
  formatUnknownError,
  FREIGHTER_INSTALL_URL,
  isFreighterAvailable,
  pollQrLoginStatus,
  signInWithWallet,
  startQrLogin,
  type FreighterIssue,
} from "@/lib/wallet";
import { LoginQr } from "./LoginQr";

type ConnectWalletProps = {
  onConnected: (publicKey: string) => void;
  autoConnectFreighter?: boolean;
  onAutoConnectHandled?: () => void;
};

type Method = "freighter" | "mobile";

function FreighterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="4" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 4V3a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="9" r="1.2" fill="currentColor" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="4.5" y="1.5" width="7" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="12" r="0.75" fill="currentColor" />
    </svg>
  );
}

function StellarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 28 28" fill="none" aria-hidden>
      <path
        d="M14 6 17.2 12.4H24L18.4 16.6 20.4 23 14 18.8 7.6 23 9.6 16.6 4 12.4H10.8L14 6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 1.5 11.5 3.5V7c0 2.8-1.9 4.4-4.5 5.5C4.4 11.4 2.5 9.8 2.5 7V3.5L7 1.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M5 7l1.4 1.4L9 5.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ConnectFlowPanel({ method }: { method: Method }) {
  const isFreighter = method === "freighter";
  const SourceIcon = isFreighter ? FreighterIcon : PhoneIcon;

  return (
    <div className="connect-flow-card relative overflow-hidden rounded-[1.35rem] border border-white/[0.1] bg-[#0a0a0d]/90">
      <div className="connect-flow-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="connect-flow-aurora pointer-events-none absolute inset-0" aria-hidden />
      <div className="connect-flow-vignette pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative p-4 md:p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
          <div
            className={`connect-flow-node rounded-2xl px-2 py-3 text-center ${
              isFreighter ? "connect-flow-node-cyan" : "connect-flow-node-violet"
            }`}
          >
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.16em] text-white/32">
              You sign
            </p>
            <div className="connect-flow-icon mx-auto mt-2.5 flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-[1rem] text-white/90">
              <SourceIcon className="h-[1.35rem] w-[1.35rem]" />
            </div>
            <p className="mt-2.5 font-[family-name:var(--font-space-grotesk)] text-[14px] font-semibold leading-tight text-white">
              {isFreighter ? "Freighter" : "Mobile"}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-white/38">
              {isFreighter ? "Browser extension" : "Phone camera"}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 px-0.5">
            <div className="connect-flow-beam" aria-hidden />
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.08] px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.14em] text-cyan-300/75">
              sign
            </span>
            <div className="connect-flow-beam" aria-hidden />
          </div>

          <div className="connect-flow-node connect-flow-node-emerald rounded-2xl px-2 py-3 text-center">
            <p className="font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.16em] text-white/32">
              Pay3 gets
            </p>
            <div className="connect-flow-icon connect-flow-icon-emerald mx-auto mt-2.5 flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-[1rem] text-emerald-400/95">
              <StellarIcon className="h-[1.35rem] w-[1.35rem]" />
            </div>
            <p className="mt-2.5 font-[family-name:var(--font-space-grotesk)] text-[14px] font-semibold leading-tight text-white">
              Pubkey
            </p>
            <p className="mt-1 text-[10px] leading-snug text-white/38">
              Challenge only
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-400/90">
            <ShieldIcon />
          </span>
          <p className="text-[11px] leading-relaxed text-white/42">
            <span className="font-medium text-white/72">Keys stay in your wallet.</span>{" "}
            Pay3 only verifies a one-time challenge signature.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConnectStatusPanel({
  code,
  codeTone = "rose",
  headline,
  hint,
  actions,
}: {
  code: string;
  codeTone?: "rose" | "amber" | "neutral";
  headline: string;
  hint?: string | null;
  actions: React.ReactNode;
}) {
  const codeClass =
    codeTone === "amber"
      ? "border-amber-400/20 bg-amber-400/[0.06] text-amber-300/70"
      : codeTone === "neutral"
        ? "border-white/10 bg-white/[0.03] text-white/40"
        : "border-rose-400/20 bg-rose-400/[0.06] text-rose-300/70";

  return (
    <div
      className="connect-flow-card relative mt-4 overflow-hidden rounded-[1.15rem] border border-white/[0.08] bg-[#0a0a0d]/95"
      role="alert"
    >
      <div
        className="connect-flow-grid pointer-events-none absolute inset-0 opacity-[0.28]"
        aria-hidden
      />
      <div className="relative flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.18em] text-white/28">
          Status
        </span>
        <span
          className={`rounded border px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.12em] ${codeClass}`}
        >
          {code}
        </span>
      </div>
      <div className="relative px-4 py-3.5">
        <p className="font-[family-name:var(--font-space-grotesk)] text-[15px] font-semibold tracking-[-0.02em] text-white/92">
          {headline}
        </p>
        {hint ? (
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/40">{hint}</p>
        ) : null}
        <div className="mt-3.5 flex flex-col gap-2">{actions}</div>
      </div>
    </div>
  );
}

function connectActionPrimaryClassName(disabled?: boolean) {
  return `w-full rounded-full bg-white py-2.5 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 ${
    disabled ? "opacity-45" : ""
  }`;
}

function connectActionSecondaryClassName() {
  return "w-full rounded-full border border-white/10 py-2.5 text-[12px] text-white/55 transition-colors hover:border-white/20 hover:text-white/78";
}

function redundantFreighterMessage(message: string | null): boolean {
  if (!message) return true;
  const m = message.toLowerCase();
  return (
    m.includes("not installed") ||
    m.includes("extension") ||
    m.includes("rejected") ||
    m.includes("declined") ||
    m.includes("denied") ||
    m.includes("freighter access denied")
  );
}

export function ConnectWallet({
  onConnected,
  autoConnectFreighter = false,
  onAutoConnectHandled,
}: ConnectWalletProps) {
  const root = useRef<HTMLDivElement>(null);
  const terminal = useRef<HTMLDivElement>(null);
  const flowPanel = useRef<HTMLDivElement>(null);
  const stepContent = useRef<HTMLDivElement>(null);

  const [method, setMethod] = useState<Method>("freighter");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freighterIssue, setFreighterIssue] = useState<FreighterIssue | null>(
    null
  );
  const [freighterDetected, setFreighterDetected] = useState<boolean | null>(
    null
  );
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [qrHint, setQrHint] = useState("Waiting for phone…");
  const claimed = useRef(false);
  const autoConnectRan = useRef(false);
  const handleConnectRef = useRef<() => Promise<void>>(async () => {});

  const isQrStep = step === 1 && method === "mobile";

  useGSAP(
    () => {
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      if (reduced) return;

      if (terminal.current) {
        gsap.fromTo(
          terminal.current,
          { opacity: 0, y: 20, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: "power3.out" }
        );
      }

      if (stepContent.current) {
        gsap.fromTo(
          stepContent.current,
          { opacity: 0, x: 12 },
          { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }
        );
      }

      if (flowPanel.current) {
        gsap.fromTo(
          flowPanel.current,
          { opacity: 0.65, scale: 0.98 },
          { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" }
        );
      }
    },
    { scope: root, dependencies: [step, method] }
  );

  function switchToMobileScan() {
    setMethod("mobile");
    setFreighterIssue(null);
    setError(null);
    resetFlow();
  }

  useEffect(() => {
    if (method !== "freighter") {
      setFreighterDetected(null);
      return;
    }

    let cancelled = false;
    isFreighterAvailable().then((ok) => {
      if (!cancelled) setFreighterDetected(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [method]);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    setFreighterIssue(null);
    try {
      const publicKey = await connectFreighter();
      const user = await signInWithWallet(publicKey);
      onConnected(user.publicKey);
    } catch (err) {
      const message = formatUnknownError(err, "Connection failed");
      const issue = classifyFreighterError(message);
      setError(message);
      if (issue === "missing" || issue === "denied" || issue === "insecure") {
        setFreighterIssue(issue);
      }
    } finally {
      setLoading(false);
    }
  }

  handleConnectRef.current = handleConnect;

  useEffect(() => {
    if (!autoConnectFreighter || autoConnectRan.current) return;
    autoConnectRan.current = true;
    onAutoConnectHandled?.();
    void handleConnectRef.current();
  }, [autoConnectFreighter, onAutoConnectHandled]);

  async function handleStartQr() {
    setLoading(true);
    setError(null);
    claimed.current = false;
    try {
      const session = await startQrLogin();
      setQrId(session.id);
      const publicOrigin = (
        process.env.NEXT_PUBLIC_QR_ORIGIN ??
        process.env.NEXT_PUBLIC_SITE_URL ??
        ""
      ).replace(/\/$/, "");
      const usePublic =
        publicOrigin.startsWith("https://") &&
        !publicOrigin.includes("localhost");
      setQrUrl(
        usePublic
          ? `${publicOrigin}/login/qr/${session.id}`
          : session.url
      );
      setStep(1);
      setQrHint(
        usePublic
          ? "Scan with your phone camera — approve in WalletConnect or Freighter."
          : "Same Wi‑Fi required, or open the login link on this device."
      );
    } catch (err) {
      setError(formatUnknownError(err, "Could not start QR login"));
    } finally {
      setLoading(false);
    }
  }

  async function handleNext() {
    if (method === "freighter") {
      await handleConnect();
    } else {
      await handleStartQr();
    }
  }

  function resetFlow() {
    setStep(0);
    setQrId(null);
    setQrUrl(null);
    setError(null);
  }

  useEffect(() => {
    if (step !== 1 || !qrId) return;

    const timer = setInterval(async () => {
      try {
        const status = await pollQrLoginStatus(qrId);
        if (status.status === "expired") {
          setError("QR expired — start again");
          resetFlow();
          return;
        }
        if (status.status === "approved" && status.claimToken && !claimed.current) {
          claimed.current = true;
          setQrHint("Signing you in on this device…");
          const user = await claimQrLogin(qrId, status.claimToken);
          onConnected(user.publicKey);
        }
      } catch {
        /* keep polling */
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [step, qrId, onConnected]);

  return (
    <div ref={root} data-dash-reveal className="connect-wallet mx-auto max-w-md px-4">
      <div
        ref={terminal}
        className="connect-terminal relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#0c0c0e]/90 p-5 shadow-[0_32px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl md:p-6"
      >
        <div className="connect-terminal-glow pointer-events-none absolute inset-0" aria-hidden />

        <div
          className="mb-6 flex rounded-full bg-black/40 p-1 ring-1 ring-white/[0.06]"
          role="tablist"
          aria-label="Sign-in method"
        >
          {(
            [
              { id: "freighter" as const, label: "Freighter" },
              { id: "mobile" as const, label: "Mobile" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={method === tab.id}
              onClick={() => {
                setMethod(tab.id);
                setError(null);
                setFreighterIssue(null);
                if (step === 1 && tab.id === "freighter") resetFlow();
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-[13px] font-medium transition-all duration-300 ${
                method === tab.id
                  ? "bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {tab.id === "freighter" ? (
                <FreighterIcon className="h-3.5 w-3.5 opacity-80" />
              ) : (
                <PhoneIcon className="h-3.5 w-3.5 opacity-80" />
              )}
              {tab.label}
            </button>
          ))}
        </div>

        <div ref={stepContent}>
          {!isQrStep ? (
            <>
              <div ref={flowPanel}>
                <ConnectFlowPanel method={method} />
              </div>
            </>
          ) : (
            <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#141416]/80 p-4">
              <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.12em] text-white/28">
                Scan to sign in
              </p>
              {qrUrl ? <LoginQr url={qrUrl} size={220} /> : null}
              <p className="text-center text-[12px] leading-relaxed text-white/45">
                {qrHint}
              </p>
              {qrId ? (
                <a
                  href={`/login/qr/${qrId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-[11px] text-white/50 underline-offset-2 hover:text-white/75 hover:underline"
                >
                  Open login link on this device
                </a>
              ) : null}
            </div>
          )}
        </div>

        {!isQrStep &&
        method === "freighter" &&
        freighterDetected === false &&
        !freighterIssue ? (
          <ConnectStatusPanel
            code="NO_EXT"
            codeTone="amber"
            headline="Extension not found"
            hint="Install Freighter, refresh, then connect."
            actions={
              <>
                <a
                  href={FREIGHTER_INSTALL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center justify-center ${connectActionPrimaryClassName()}`}
                >
                  Get Freighter
                </a>
                <button
                  type="button"
                  onClick={switchToMobileScan}
                  className={connectActionSecondaryClassName()}
                >
                  Mobile scan instead
                </button>
              </>
            }
          />
        ) : null}

        {freighterIssue ? (
          <ConnectStatusPanel
            code={
              freighterIssue === "missing"
                ? "NO_EXT"
                : freighterIssue === "insecure"
                  ? "NO_SSL"
                  : "DENIED"
            }
            codeTone={
              freighterIssue === "denied" ? "rose" : "amber"
            }
            headline={
              freighterIssue === "missing"
                ? "Extension not found"
                : freighterIssue === "insecure"
                  ? "Freighter blocked localhost"
                  : "Popup closed"
            }
            hint={
              freighterIssue === "missing"
                ? "Install Freighter, refresh, then connect."
                : freighterIssue === "insecure"
                  ? "Freighter Settings → Preferences → Advanced → allow non-HTTPS. Set network to Mainnet. Or open the HTTPS site instead."
                  : redundantFreighterMessage(error)
                    ? "Approve the Freighter popup, or use your phone."
                    : error
            }
            actions={
              <>
                {freighterIssue === "missing" ? (
                  <a
                    href={FREIGHTER_INSTALL_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center justify-center ${connectActionPrimaryClassName()}`}
                  >
                    Get Freighter
                  </a>
                ) : freighterIssue === "insecure" ? (
                  <a
                    href="https://paythreewallet.vercel.app/dashboard?connect=freighter"
                    className={`inline-flex items-center justify-center ${connectActionPrimaryClassName()}`}
                  >
                    Open HTTPS site
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setFreighterIssue(null);
                      setError(null);
                      void handleConnect();
                    }}
                    disabled={loading}
                    className={connectActionPrimaryClassName(loading)}
                  >
                    Connect again
                  </button>
                )}
                {freighterIssue === "insecure" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFreighterIssue(null);
                      setError(null);
                      void handleConnect();
                    }}
                    disabled={loading}
                    className={connectActionSecondaryClassName()}
                  >
                    I enabled non-HTTPS — retry
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={switchToMobileScan}
                    className={connectActionSecondaryClassName()}
                  >
                    Mobile scan instead
                  </button>
                )}
              </>
            }
          />
        ) : null}

        {error && !freighterIssue ? (
          <ConnectStatusPanel
            code="ERR"
            codeTone="neutral"
            headline={
              method === "freighter" ? "Connect failed" : "QR sign-in failed"
            }
            hint={error}
            actions={
              method === "freighter" ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      void handleConnect();
                    }}
                    disabled={loading}
                    className={connectActionPrimaryClassName(loading)}
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={switchToMobileScan}
                    className={connectActionSecondaryClassName()}
                  >
                    Mobile scan instead
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className={connectActionSecondaryClassName()}
                >
                  Dismiss
                </button>
              )
            }
          />
        ) : null}

        {!isQrStep ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={loading}
            className="connect-next-btn mt-6 w-full rounded-full bg-white py-3.5 text-[14px] font-semibold text-black transition-[transform,box-shadow,opacity] duration-300 hover:scale-[1.01] hover:shadow-[0_8px_32px_rgba(255,255,255,0.12)] active:scale-[0.99] disabled:opacity-45"
          >
            {loading
              ? autoConnectFreighter && method === "freighter"
                ? "Opening Freighter…"
                : "Working…"
              : method === "freighter"
                ? "Connect Freighter"
                : "Next step"}
          </button>
        ) : (
          <button
            type="button"
            onClick={resetFlow}
            className="mt-6 w-full rounded-full border border-white/12 py-3 text-[13px] text-white/55 transition-colors hover:border-white/25 hover:text-white/80"
          >
            ← Back
          </button>
        )}

        <p className="mt-4 text-center font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-white/25">
          Stellar mainnet · Freighter required for desktop
        </p>
      </div>
    </div>
  );
}
