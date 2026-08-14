/**
 * DeFi swap execute via Soroswap (legacy G allocation only).
 * Quote → build → sign → send. No financial auto-retry.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@pay3/database";
import { APPROVAL_TTL_MS, MAX_TECHNICAL_RETRIES } from "@pay3/shared";
import { evaluatePolicy } from "@pay3/policy-engine";
import {
  isSessionActive,
  type SessionPolicyRules,
} from "@pay3/session-manager";
import {
  canRetrySubmit,
  nextRetryCount,
} from "@pay3/transaction-engine";
import {
  getHorizonServer,
  getNetworkPassphrase,
  isTechnicalSubmitError,
  signTransactionXdr,
} from "@pay3/stellar";
import { decryptSecret } from "./crypto.js";
import { isContractCustody } from "./onchain-session.js";
import {
  buildSwapTransaction,
  DEFAULT_EXECUTE_SLIPPAGE_BPS,
  EXECUTE_PROTOCOLS,
  getSoroswapConfig,
  getSwapQuoteBundle,
  sendSignedSwap,
  SoroswapError,
  type TradeType,
  type TrustlineRequired,
} from "./soroswap.js";
import {
  spentTodayForSession,
  toTxView,
} from "./transfer-service.js";

function asRules(json: unknown): SessionPolicyRules | null {
  if (!json || typeof json !== "object") return null;
  const r = json as Record<string, unknown>;
  if (
    typeof r.durationHours !== "number" ||
    typeof r.dailyBudget !== "string" ||
    typeof r.asset !== "string" ||
    typeof r.perTxMax !== "string" ||
    typeof r.approvalAbove !== "string" ||
    !Array.isArray(r.allowedActions)
  ) {
    return null;
  }
  return {
    durationHours: r.durationHours,
    dailyBudget: r.dailyBudget,
    asset: r.asset,
    perTxMax: r.perTxMax,
    approvalAbove: r.approvalAbove,
    allowedActions: r.allowedActions.map(String),
    blockedNotes: Array.isArray(r.blockedNotes)
      ? r.blockedNotes.map(String)
      : [],
  };
}

function isUniqueConflict(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

async function writeAudit(
  userId: string,
  action: string,
  metadata: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      metadata: JSON.parse(JSON.stringify(metadata)) as object,
    },
  });
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

async function bumpMonthlyUsage(userId: string, amount: string) {
  const month = currentMonthKey();
  const n = Number(amount);
  const add = Number.isFinite(n) ? n : 0;
  const existing = await prisma.usageRecord.findUnique({
    where: { userId_month: { userId, month } },
  });
  const prev = Number(existing?.volumeUsd ?? "0");
  const volume = Number.isFinite(prev) ? prev + add : add;
  await prisma.usageRecord.upsert({
    where: { userId_month: { userId, month } },
    create: {
      userId,
      month,
      txCount: 1,
      volumeUsd: String(volume),
    },
    update: {
      txCount: { increment: 1 },
      volumeUsd: String(volume),
    },
  });
}

/** Soroswap network must match STELLAR_NETWORK_PASSPHRASE (same chain). */
export function assertSwapNetworkAligned(): void {
  const { network } = getSoroswapConfig();
  const pass = getNetworkPassphrase();
  const stellarMain = pass.includes("Public Global");
  if (network === "mainnet" && !stellarMain) {
    throw Object.assign(
      new Error(
        "SOROSWAP_NETWORK=mainnet but Stellar env is testnet — align networks before execute_swap"
      ),
      { status: 503 }
    );
  }
  if (network === "testnet" && stellarMain) {
    throw Object.assign(
      new Error(
        "SOROSWAP_NETWORK=testnet but Stellar env is mainnet — align networks before execute_swap"
      ),
      { status: 503 }
    );
  }
}

export type SwapInput = {
  userId: string;
  sessionId: string;
  assetIn: string;
  assetOut: string;
  amount: string;
  tradeType?: TradeType;
  slippageBps?: number;
  idempotencyKey?: string;
};

/**
 * Full swap lifecycle: policy → approve/auto → quote → build → sign → send.
 * Legacy G allocation only. Slippage / underfunded = financial fail (no retry).
 */
export async function executeSwap(input: SwapInput) {
  assertSwapNetworkAligned();

  const assetIn = input.assetIn.trim().toUpperCase();
  const assetOut = input.assetOut.trim().toUpperCase();
  const amount = input.amount.trim();
  const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();

  const existing = await prisma.transaction.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return { transaction: toTxView(existing), idempotentReplay: true };
  }

  const session = await prisma.aiSession.findFirst({
    where: { id: input.sessionId, userId: input.userId },
    include: { policy: true },
  });
  if (!session) {
    throw Object.assign(new Error("session not found"), { status: 404 });
  }

  if (
    session.status === "active" &&
    session.expiresAt &&
    session.expiresAt <= new Date() &&
    !session.revokedAt
  ) {
    await prisma.aiSession.update({
      where: { id: session.id },
      data: { status: "expired" },
    });
    session.status = "expired";
  }

  const smartAccount = await prisma.smartAccount.findUnique({
    where: { userId: input.userId },
  });
  if (!smartAccount) {
    throw Object.assign(new Error("smart account not linked"), { status: 400 });
  }
  if (isContractCustody(smartAccount)) {
    throw Object.assign(
      new Error(
        "execute_swap is not available for contract custody yet — use legacy G allocation"
      ),
      { status: 501 }
    );
  }
  if (!smartAccount.publicKey || !smartAccount.encryptedSecret) {
    throw Object.assign(new Error("smart account not linked"), { status: 400 });
  }

  let tx;
  try {
    // ponytail: recipient column stores asset_out for swaps (no schema change)
    tx = await prisma.transaction.create({
      data: {
        userId: input.userId,
        sessionId: session.id,
        idempotencyKey,
        action: "execute_swap",
        asset: assetIn,
        amount,
        recipient: assetOut,
        status: "CREATED",
      },
    });
    await prisma.idempotencyRecord.create({
      data: { key: idempotencyKey, transactionId: tx.id },
    });
  } catch (err) {
    if (isUniqueConflict(err)) {
      const again = await prisma.transaction.findUnique({
        where: { idempotencyKey },
      });
      if (again) {
        return { transaction: toTxView(again), idempotentReplay: true };
      }
    }
    throw err;
  }

  tx = await prisma.transaction.update({
    where: { id: tx.id },
    data: { status: "VALIDATING" },
  });

  const rules = asRules(session.policy?.rulesJson);
  if (!rules) {
    tx = await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: "REJECTED",
        policyDecision: "REJECTED",
        completedAt: new Date(),
      },
    });
    throw Object.assign(new Error("session has no usable policy"), {
      status: 400,
      transaction: toTxView(tx),
    });
  }

  const spent = await spentTodayForSession(session.id, assetIn);
  const policy = evaluatePolicy(
    {
      action: "execute_swap",
      asset: assetIn,
      amount,
      recipient: assetOut,
    },
    {
      rules,
      sessionActive: isSessionActive(session),
      spentToday: spent,
    }
  );

  if (policy.decision === "REJECTED") {
    tx = await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: "REJECTED",
        policyDecision: "REJECTED",
        completedAt: new Date(),
      },
    });
    await writeAudit(input.userId, "swap_rejected", {
      transactionId: tx.id,
      reason: policy.reason,
    });
    return { transaction: toTxView(tx), policy, idempotentReplay: false };
  }

  if (policy.decision === "PENDING_APPROVAL") {
    tx = await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: "PENDING_APPROVAL",
        policyDecision: "PENDING_APPROVAL",
      },
    });
    const approval = await prisma.approvalRequest.create({
      data: {
        userId: input.userId,
        transactionId: tx.id,
        status: "pending",
        expiresAt: new Date(Date.now() + APPROVAL_TTL_MS),
      },
    });
    await writeAudit(input.userId, "swap_pending_approval", {
      transactionId: tx.id,
      approvalId: approval.id,
      assetIn,
      assetOut,
      amount,
    });
    return {
      transaction: toTxView(tx),
      policy,
      approval: {
        id: approval.id,
        expiresAt: approval.expiresAt.toISOString(),
      },
      idempotentReplay: false,
    };
  }

  tx = await prisma.transaction.update({
    where: { id: tx.id },
    data: {
      status: "AUTO_APPROVED",
      policyDecision: "AUTO_EXECUTE",
    },
  });

  return finalizeSwapSubmit(tx.id, {
    assetIn,
    assetOut,
    amount,
    tradeType: input.tradeType,
    slippageBps: input.slippageBps,
    userId: input.userId,
  });
}

function trustlineFromError(err: unknown): TrustlineRequired | null {
  if (!err || typeof err !== "object") return null;
  const trust = (err as { trustline?: TrustlineRequired }).trustline;
  if (trust?.kind === "CREATE_TRUSTLINE" && trust.xdr) return trust;
  return null;
}

/**
 * Build swap XDR. If Soroswap asks for a missing output trustline, create it
 * once from the allocation G-account, then rebuild.
 */
async function buildSwapOrCreateTrustline(opts: {
  quote: Record<string, unknown>;
  from: string;
  secret: string;
  userId: string;
  transactionId: string;
}): Promise<{ xdr: string }> {
  try {
    return await buildSwapTransaction({
      quote: opts.quote,
      from: opts.from,
      to: opts.from,
    });
  } catch (err) {
    const trust = trustlineFromError(err);
    if (!trust) throw err;

    const signedTrust = await signTransactionXdr({
      secret: opts.secret,
      xdr: trust.xdr,
    });
    const { TransactionBuilder } = await import("@stellar/stellar-sdk");
    const envelope = TransactionBuilder.fromXDR(
      signedTrust,
      getNetworkPassphrase()
    );
    const submitted = await getHorizonServer().submitTransaction(envelope);
    await writeAudit(opts.userId, "swap_trustline_created", {
      transactionId: opts.transactionId,
      hash: submitted.hash,
      message: trust.message,
    });

    return buildSwapTransaction({
      quote: opts.quote,
      from: opts.from,
      to: opts.from,
    });
  }
}

export async function finalizeSwapSubmit(
  transactionId: string,
  opts: {
    assetIn: string;
    assetOut: string;
    amount: string;
    tradeType?: TradeType;
    slippageBps?: number;
    userId: string;
  }
) {
  assertSwapNetworkAligned();

  let tx = await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: "SIGNING" },
  });

  const smartAccount = await prisma.smartAccount.findUnique({
    where: { userId: opts.userId },
  });
  if (!smartAccount?.publicKey || !smartAccount.encryptedSecret) {
    throw Object.assign(new Error("smart account missing"), { status: 400 });
  }
  if (isContractCustody(smartAccount)) {
    throw Object.assign(
      new Error("execute_swap not available for contract custody"),
      { status: 501 }
    );
  }

  let secret: string;
  try {
    secret = decryptSecret(smartAccount.encryptedSecret);
  } catch {
    throw Object.assign(new Error("failed to unlock allocation account"), {
      status: 500,
    });
  }

  try {
    const bundle = await getSwapQuoteBundle({
      assetIn: opts.assetIn,
      assetOut: opts.assetOut,
      amount: opts.amount,
      tradeType: opts.tradeType,
      // ponytail: execute needs headroom; 0.5% often fails mid-route on aqua hops
      slippageBps: Math.max(opts.slippageBps ?? DEFAULT_EXECUTE_SLIPPAGE_BPS, 100),
      protocols: [...EXECUTE_PROTOCOLS],
    });

    const { xdr } = await buildSwapOrCreateTrustline({
      quote: bundle.raw,
      from: smartAccount.publicKey,
      secret,
      userId: opts.userId,
      transactionId,
    });

    const signedXdr = await signTransactionXdr({ secret, xdr });

    let retryCount = tx.retryCount;
    let hash: string | undefined;
    for (;;) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { status: "SUBMITTING", retryCount },
      });
      try {
        const sent = await sendSignedSwap(signedXdr);
        hash = sent.txHash;
        break;
      } catch (err) {
        // ponytail: only retry technical send failures; never rebuild/re-sign (slippage financial)
        if (!isTechnicalSubmitError(err) || !canRetrySubmit(retryCount)) {
          throw err;
        }
        retryCount = nextRetryCount(retryCount);
        if (retryCount > MAX_TECHNICAL_RETRIES) throw err;
      }
    }

    tx = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "SUCCESS",
        stellarTransactionHash: hash,
        retryCount,
        completedAt: new Date(),
      },
    });
    await writeAudit(opts.userId, "swap_success", {
      transactionId: tx.id,
      hash,
      assetIn: opts.assetIn,
      assetOut: opts.assetOut,
      amountIn: bundle.result.amountInDecimal,
      amountOut: bundle.result.amountOutDecimal,
      network: bundle.result.network,
    });
    await bumpMonthlyUsage(opts.userId, opts.amount);
    return {
      transaction: toTxView(tx),
      policy: { decision: "AUTO_EXECUTE" as const },
      quote: bundle.result,
      idempotentReplay: false,
    };
  } catch (err) {
    tx = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "FAILED", completedAt: new Date() },
    });
    const message =
      err instanceof SoroswapError
        ? err.message
        : err instanceof Error
          ? err.message
          : "swap submit failed";
    await writeAudit(opts.userId, "swap_failed", {
      transactionId: tx.id,
      error: message,
    });
    throw Object.assign(new Error(message), {
      status: err instanceof SoroswapError ? err.status : 502,
      transaction: toTxView(tx),
    });
  }
}
