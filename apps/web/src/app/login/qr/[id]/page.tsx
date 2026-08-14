"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  completeQrLoginWithFreighter,
  connectFreighter,
} from "@/lib/wallet";
import { WalletConnectLoginButton } from "@/components/login/WalletConnectLoginButton";
import { isConnected } from "@stellar/freighter-api";

export default function QrLoginPage() {
  const params = useParams();
  const loginId = String(params?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [hasFreighter, setHasFreighter] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    isConnected()
      .then((ok) => {
        if (!cancelled) setHasFreighter(Boolean(ok));
      })
      .catch(() => {
        if (!cancelled) setHasFreighter(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFreighter() {
    if (!loginId) return;
    setLoading(true);
    setError(null);
    try {
      const publicKey = await connectFreighter();
      await completeQrLoginWithFreighter(loginId, publicKey);
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      setError(
        msg.includes("not installed")
          ? "Freighter browser extension not found. On phone use WalletConnect (needs project id), or open this link on your PC with Freighter installed."
          : msg
      );
    } finally {
      setLoading(false);
    }
  }

  if (!loginId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12 text-center">
        <p className="text-red-400">Invalid login link</p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12 text-center">
        <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold">
          Signed in
        </h1>
        <p className="mt-3 text-sm text-white/60">
          You’re signed in on desktop — you can close this tab.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12 text-center">
      <h1 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold">
        Approve desktop login
      </h1>
      <p className="mt-3 text-sm text-white/60">
        Approve on this device to finish signing in on your computer. Your primary key never leaves
        your wallet.
      </p>

      {hasFreighter === false ? (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          No Freighter extension here (normal on phones). Use WalletConnect below, or open this URL
          on your PC and tap Sign with Freighter.
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleFreighter}
        disabled={loading}
        className="btn-primary mt-8 w-full disabled:opacity-50"
      >
        {loading ? "Waiting for signature…" : "Sign with Freighter"}
      </button>

      <div className="mt-3">
        <WalletConnectLoginButton
          loginId={loginId}
          disabled={loading}
          onDone={() => setDone(true)}
          onError={(msg) => setError(msg || null)}
        />
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </main>
  );
}
