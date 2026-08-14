import SignClient from "@walletconnect/sign-client";
import type { SessionTypes } from "@walletconnect/types";
import { apiFetch } from "./api";
import type { AuthChallengeResponse } from "@pay3/shared";
import { NETWORK_LABEL, WC_STELLAR_CHAIN } from "./network";
import {
  completeQrLoginWithSignature,
  normalizeWalletSignature,
} from "./wallet";

function siteUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://paythreewallet.vercel.app"
  ).replace(/\/$/, "");
}

function projectId(): string {
  return (process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "").trim();
}

export function walletConnectConfigured(): boolean {
  return projectId().length > 0;
}

function publicKeyFromSession(session: SessionTypes.Struct): string {
  const accounts = session.namespaces?.stellar?.accounts ?? [];
  const first = accounts[0];
  if (!first) throw new Error("WalletConnect session has no Stellar account");
  // CAIP-10: stellar:pubnet:G... or stellar:testnet:G...
  const parts = first.split(":");
  const pk = parts[parts.length - 1];
  if (!pk?.startsWith("G")) throw new Error("Invalid Stellar account in session");
  return pk;
}

export type WcConnectHandlers = {
  onUri?: (uri: string) => void;
};

/**
 * Connect via WalletConnect (Freighter Mobile / Lobstr / etc.), SEP-53 sign, complete QR room.
 */
export async function completeQrLoginWithWalletConnect(
  loginId: string,
  handlers?: WcConnectHandlers
): Promise<void> {
  const id = projectId();
  if (!id) {
    throw new Error(
      "Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID (WalletConnect Cloud project id)"
    );
  }

  const client = await SignClient.init({
    projectId: id,
    metadata: {
      name: "Pay3",
      description: `Pay3 ${NETWORK_LABEL} — QR sign-in`,
      url: siteUrl(),
      icons: [`${siteUrl()}/favicon.ico`, `${siteUrl()}/pay3-logo.png`],
    },
  });

  const { uri, approval } = await client.connect({
    requiredNamespaces: {
      stellar: {
        methods: [
          "stellar_signMessage",
          "stellar_signXDR",
          "stellar_signAndSubmitXDR",
          "stellar_signAuthEntry",
        ],
        chains: [WC_STELLAR_CHAIN],
        events: ["accountsChanged"],
      },
    },
  });

  if (uri) {
    handlers?.onUri?.(uri);
    // Deep-link on mobile when the wallet is installed
    try {
      window.location.href = uri;
    } catch {
      /* ignore */
    }
  }

  const session = await approval();
  const publicKey = publicKeyFromSession(session);

  const challenge = await apiFetch<AuthChallengeResponse>("/auth/challenge", {
    method: "POST",
    body: JSON.stringify({ publicKey }),
  });

  const result = (await client.request({
    topic: session.topic,
    chainId: WC_STELLAR_CHAIN,
    request: {
      method: "stellar_signMessage",
      params: { message: challenge.message },
    },
  })) as { signature?: string };

  if (!result?.signature) {
    throw new Error("Wallet did not return a signature");
  }

  await completeQrLoginWithSignature(
    loginId,
    publicKey,
    challenge.nonce,
    normalizeWalletSignature(result.signature)
  );

  try {
    await client.disconnect({
      topic: session.topic,
      reason: { code: 6000, message: "Pay3 QR login complete" },
    });
  } catch {
    /* ignore */
  }
}
