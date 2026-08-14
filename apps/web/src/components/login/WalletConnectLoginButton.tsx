"use client";

import { useState } from "react";
import {
  completeQrLoginWithWalletConnect,
  walletConnectConfigured,
} from "@/lib/walletconnect-login";
import { LoginQr } from "@/components/dashboard/LoginQr";

type Props = {
  loginId: string;
  disabled?: boolean;
  onDone: () => void;
  onError: (message: string) => void;
};

export function WalletConnectLoginButton({
  loginId,
  disabled,
  onDone,
  onError,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [wcUri, setWcUri] = useState<string | null>(null);
  const configured = walletConnectConfigured();

  async function handleClick() {
    if (!configured) {
      onError(
        "WalletConnect not configured — set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID"
      );
      return;
    }
    setLoading(true);
    setWcUri(null);
    onError("");
    try {
      await completeQrLoginWithWalletConnect(loginId, {
        onUri: (uri) => setWcUri(uri),
      });
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : "WalletConnect failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className="w-full rounded-full border border-white/20 px-4 py-3 text-sm text-white/90 transition hover:border-white/40 disabled:opacity-50"
      >
        {loading
          ? "Approve in your wallet…"
          : configured
            ? "Connect wallet app (WalletConnect)"
            : "WalletConnect (needs project id)"}
      </button>
      {wcUri ? (
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-3 text-xs text-white/50">
            If your wallet didn’t open, scan this WalletConnect QR:
          </p>
          <LoginQr url={wcUri} size={180} />
        </div>
      ) : null}
    </div>
  );
}
