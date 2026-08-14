import { Horizon, Keypair, Networks } from "@stellar/stellar-sdk";

export {
  xlmToStroops,
  stroopsToXlm,
  getNativeSacContractId,
  getRpcServer,
  buildNativeSacTransferOp,
  validateExactSacTransferAuth,
  signSessionAuthEntries,
  buildSimulateSignContractPayment,
  submitSignedSorobanXdr,
  classifySorobanFailure,
  isRetryableSorobanFailure,
  getContractXlmBalance,
  fundContractAccountFromG,
  uploadContractWasm,
  deploySmartAccountContract,
  buildSessionAdminOp,
  rawEd25519PublicKey,
  stellarSorobanSelfCheck,
  DEFAULT_SOROBAN_RPC,
  type SorobanFailureClass,
  type ExpectedTransfer,
} from "./soroban.js";

export type AssetBalance = {
  asset: string;
  balance: string;
};

export type HorizonPayment = {
  id: string;
  type: string;
  createdAt: string;
  amount: string | null;
  asset: string | null;
  from: string | null;
  to: string | null;
  transactionHash: string | null;
};

export type AllocationFundMethod = "friendbot" | "create_account" | "none";

export function getNetworkPassphrase(): string {
  return (
    process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.PUBLIC
  );
}

/** True when STELLAR_NETWORK_PASSPHRASE is Stellar public mainnet. */
export function isMainnet(): boolean {
  const p = getNetworkPassphrase();
  return p === Networks.PUBLIC || p.includes("Public Global");
}

export function getHorizonUrl(): string {
  return (
    process.env.STELLAR_HORIZON_URL ??
    (isMainnet()
      ? "https://horizon.stellar.org"
      : "https://horizon-testnet.stellar.org")
  );
}

/** stellar.expert path segment */
export function getExplorerNetwork(): "public" | "testnet" {
  return isMainnet() ? "public" : "testnet";
}

/** Interim G-account vs future Soroban contract id (`C…`). */
export type CustodyMode = "interim_g_account" | "soroban_contract";

export function custodyModeFromRef(contractRef: string | null | undefined): CustodyMode {
  if (contractRef && contractRef.startsWith("C")) return "soroban_contract";
  return "interim_g_account";
}

export function getHorizonServer(): Horizon.Server {
  return new Horizon.Server(getHorizonUrl());
}

export function createAllocationKeypair(): {
  publicKey: string;
  secret: string;
} {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secret: kp.secret() };
}

/** Fund a new testnet account via Friendbot so it exists on-chain. */
export async function fundTestnetAccount(publicKey: string): Promise<void> {
  if (isMainnet()) {
    throw new Error("Friendbot is testnet-only — refuse on mainnet");
  }
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
  );
  if (!res.ok) {
    const text = await res.text();
    // Already funded is fine
    if (!text.includes("createAccountAlreadyExist") && !text.includes("op_already_exists")) {
      throw new Error(`Friendbot failed: ${res.status} ${text.slice(0, 200)}`);
    }
  }
}

/**
 * Create + fund a G-account on mainnet via createAccount (relayer pays).
 * Starting balance must cover base reserve (default 2 XLM).
 */
export async function createAccountFromRelayer(opts: {
  relayerSecret: string;
  destination: string;
  startingBalance?: string;
}): Promise<{ hash: string }> {
  const { TransactionBuilder, Operation, BASE_FEE } = await import(
    "@stellar/stellar-sdk"
  );
  const server = getHorizonServer();
  const source = Keypair.fromSecret(opts.relayerSecret);
  const account = await server.loadAccount(source.publicKey());
  const startingBalance = opts.startingBalance ?? process.env.MAINNET_JAR_SEED_XLM ?? "2";

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      Operation.createAccount({
        destination: opts.destination,
        startingBalance,
      })
    )
    .setTimeout(60)
    .build();

  tx.sign(source);
  const result = await server.submitTransaction(tx);
  return { hash: result.hash };
}

/**
 * Bring a newly generated allocation G-address onto the configured network.
 * - testnet → Friendbot
 * - mainnet + RELAYER_SECRET → createAccount seed
 * - mainnet without relayer → none (user must fund from Freighter)
 */
export async function ensureAllocationOnChain(
  publicKey: string
): Promise<{ method: AllocationFundMethod; hash?: string }> {
  if (!isMainnet()) {
    await fundTestnetAccount(publicKey);
    return { method: "friendbot" };
  }

  const relayer = process.env.RELAYER_SECRET?.trim();
  if (relayer) {
    const { hash } = await createAccountFromRelayer({
      relayerSecret: relayer,
      destination: publicKey,
    });
    return { method: "create_account", hash };
  }

  return { method: "none" };
}

export async function getAccountBalances(
  publicKey: string
): Promise<AssetBalance[]> {
  const server = getHorizonServer();
  try {
    const account = await server.loadAccount(publicKey);
    return account.balances.map((b) => {
      if (b.asset_type === "native") {
        return { asset: "XLM", balance: b.balance };
      }
      if ("asset_code" in b) {
        return {
          asset: `${b.asset_code}:${"asset_issuer" in b ? b.asset_issuer.slice(0, 4) : ""}…`,
          balance: b.balance,
        };
      }
      return { asset: b.asset_type, balance: b.balance };
    });
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
    if (status === 404) return [];
    throw err;
  }
}

export async function getAccountPayments(
  publicKey: string,
  limit = 25
): Promise<HorizonPayment[]> {
  const server = getHorizonServer();
  try {
    const page = await server
      .payments()
      .forAccount(publicKey)
      .order("desc")
      .limit(limit)
      .call();

    return page.records.map((r) => {
      const rec = r as Horizon.ServerApi.PaymentOperationRecord & {
        amount?: string;
        asset_type?: string;
        asset_code?: string;
        from?: string;
        to?: string;
        transaction_hash?: string;
      };
      let asset: string | null = null;
      if (rec.asset_type === "native") asset = "XLM";
      else if (rec.asset_code) asset = rec.asset_code;

      return {
        id: rec.id,
        type: rec.type,
        createdAt: rec.created_at,
        amount: rec.amount ?? null,
        asset,
        from: rec.from ?? null,
        to: rec.to ?? null,
        transactionHash: rec.transaction_hash ?? null,
      };
    });
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
    if (status === 404) return [];
    throw err;
  }
}

export function formatXlm(balance: string): string {
  const n = Number(balance);
  if (Number.isNaN(n)) return balance;
  return n.toFixed(4);
}

/**
 * Send native XLM from a funded account. Secret used only in-memory.
 * If destination G-address is not on-chain yet, uses createAccount
 * (requires startingBalance >= ~1 XLM for base reserves).
 * Returns Horizon transaction hash.
 */
export async function submitNativePayment(opts: {
  secret: string;
  destination: string;
  amount: string;
}): Promise<{ hash: string; createdAccount?: boolean }> {
  const { TransactionBuilder, Asset, Operation, BASE_FEE } = await import(
    "@stellar/stellar-sdk"
  );
  const server = getHorizonServer();
  const source = Keypair.fromSecret(opts.secret);
  const account = await server.loadAccount(source.publicKey());

  let destinationExists = true;
  try {
    await server.loadAccount(opts.destination);
  } catch (err: unknown) {
    const status =
      err && typeof err === "object" && "response" in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
    if (status === 404) destinationExists = false;
    else throw err;
  }

  if (!destinationExists) {
    const n = Number(opts.amount);
    // ponytail: Stellar min = 2 × base reserve (~1 XLM); clear error beats opaque Horizon fail
    if (!Number.isFinite(n) || n < 1) {
      throw Object.assign(
        new Error(
          `Destination ${opts.destination.slice(0, 6)}… is not on the network yet. Send at least 1 XLM to create the account, or fund it first.`
        ),
        { status: 400 }
      );
    }
  }

  const op = destinationExists
    ? Operation.payment({
        destination: opts.destination,
        asset: Asset.native(),
        amount: opts.amount,
      })
    : Operation.createAccount({
        destination: opts.destination,
        startingBalance: opts.amount,
      });

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  tx.sign(source);

  const result = await server.submitTransaction(tx);
  return { hash: result.hash, createdAccount: !destinationExists };
}

/**
 * Sign an envelope XDR with a G-account secret (in-memory only).
 * Used for Soroswap-built swap transactions.
 */
export async function signTransactionXdr(opts: {
  secret: string;
  xdr: string;
}): Promise<string> {
  const { TransactionBuilder } = await import("@stellar/stellar-sdk");
  const tx = TransactionBuilder.fromXDR(opts.xdr, getNetworkPassphrase());
  tx.sign(Keypair.fromSecret(opts.secret));
  return tx.toXDR();
}

/** Classify Horizon/network errors for smart retry (§27). */
export function isTechnicalSubmitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("insufficient") || lower.includes("op_underfunded")) {
    return false;
  }
  if (lower.includes("op_no_destination") || lower.includes("forbidden")) {
    return false;
  }
  // Network / 5xx / timeout style
  if (
    lower.includes("timeout") ||
    lower.includes("econnreset") ||
    lower.includes("fetch failed") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("504") ||
    lower.includes("network")
  ) {
    return true;
  }
  // Horizon tx_failed with only technical extras is rare; default no retry for op failures
  if (lower.includes("tx_failed") || lower.includes("op_")) {
    return false;
  }
  return true;
}
