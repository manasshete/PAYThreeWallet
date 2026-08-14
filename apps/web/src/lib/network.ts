/** Client-side Stellar network helpers (from NEXT_PUBLIC_STELLAR_NETWORK). */

export const STELLAR_NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ??
  "Public Global Stellar Network ; September 2015";

export const IS_MAINNET = STELLAR_NETWORK.includes("Public");

/** WalletConnect CAIP-2 chain id */
export const WC_STELLAR_CHAIN = IS_MAINNET ? "stellar:pubnet" : "stellar:testnet";

/** stellar.expert explorer segment */
export const EXPLORER_NETWORK = IS_MAINNET ? "public" : "testnet";

/** Horizon REST endpoint (used to build/submit Freighter-signed funding payments). */
export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ??
  (IS_MAINNET
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org");

export function stellarExpertTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/${EXPLORER_NETWORK}/tx/${hash}`;
}

export const NETWORK_LABEL = IS_MAINNET ? "Stellar mainnet" : "Stellar testnet";
