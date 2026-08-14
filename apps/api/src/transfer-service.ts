import { randomUUID } from "node:crypto";
import { prisma } from "@pay3/database";
import type { Prisma } from "@prisma/client";
import { APPROVAL_TTL_MS, MAX_TECHNICAL_RETRIES } from "@pay3/shared";
import { evaluatePolicy } from "@pay3/policy-engine";
import { resolveRecipient } from "@pay3/recipient-resolver";
import {
  isSessionActive,
  type SessionPolicyRules,
} from "@pay3/session-manager";
import {
  canRetrySubmit,
  nextRetryCount,
} from "@pay3/transaction-engine";
import {
  buildSimulateSignContractPayment,
  classifySorobanFailure,
  isRetryableSorobanFailure,
  isTechnicalSubmitError,
  submitNativePayment,
  submitSignedSorobanXdr,
  type SorobanFailureClass,
} from "@pay3/stellar";
import { decryptSecret } from "./crypto.js";
import { isContractCustody } from "./onchain-session.js";

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

export function toTxView(t: {
  id: string;
  sessionId: string | null;
  action: string;
  asset: string | null;
  amount: string | null;
  recipient: string | null;
  policyDecision: string | null;
  status: string;
  stellarTransactionHash: string | null;
  retryCount: number;
  idempotencyKey: string | null;
  createdAt: Date;
  completedAt: Date | null;
}) {
  return {
    id: t.id,
    sessionId: t.sessionId,
    action: t.action,
    asset: t.asset,
    amount: t.amount,
    recipient: t.recipient,
    policyDecision: t.policyDecision,
    status: t.status,
    stellarTransactionHash: t.stellarTransactionHash,
    retryCount: t.retryCount,
    idempotencyKey: t.idempotencyKey,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
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

async function spentToday(sessionId: string, asset: string): Promise<string> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const txs = await prisma.transaction.findMany({
    where: {
      sessionId,
      action: { in: ["transfer", "execute_swap", "x402_fetch"] },
      status: "SUCCESS",
      createdAt: { gte: start },
      asset: { equals: asset, mode: "insensitive" },
    },
    select: { amount: true },
  });
  let total = 0;
  for (const t of txs) {
    const n = Number(t.amount ?? 0);
    if (Number.isFinite(n)) total += n;
  }
  return String(total);
}

/** Shared with swap-service for daily budget accounting. */
export async function spentTodayForSession(
  sessionId: string,
  asset: string
): Promise<string> {
  return spentToday(sessionId, asset);
}

async function writeAudit(
  userId: string,
  action: string,
  metadata: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: { userId, action, metadata: metadata as Prisma.InputJsonValue },
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
      // ponytail: volumeUsd holds native XLM volume until USDC lands
      volumeUsd: String(volume),
    },
    update: {
      txCount: { increment: 1 },
      volumeUsd: String(volume),
    },
  });
}

function requireRelayerSecret(): string {
  const s = process.env.RELAYER_SECRET?.trim();
  if (!s || !s.startsWith("S")) {
    throw Object.assign(new Error("RELAYER_SECRET not configured"), {
      status: 503,
      failureClass: "unknown" as SorobanFailureClass,
    });
  }
  return s;
}

async function submitLegacyWithRetry(
  transactionId: string,
  secret: string,
  destination: string,
  amount: string,
  startRetry: number
): Promise<{ hash: string; retryCount: number }> {
  let retryCount = startRetry;
  for (;;) {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "SUBMITTING", retryCount },
    });
    try {
      const { hash } = await submitNativePayment({
        secret,
        destination,
        amount,
      });
      return { hash, retryCount };
    } catch (err) {
      if (!isTechnicalSubmitError(err) || !canRetrySubmit(retryCount)) {
        throw err;
      }
      retryCount = nextRetryCount(retryCount);
      if (retryCount > MAX_TECHNICAL_RETRIES) throw err;
    }
  }
}

/**
 * Build+sign once, then retry the same signed XDR only (never rebuild payment).
 */
async function submitContractWithRetry(opts: {
  transactionId: string;
  contractAccountId: string;
  sessionSecret: string;
  destination: string;
  amount: string;
  startRetry: number;
}): Promise<{ hash: string; retryCount: number; signedXdr: string }> {
  const relayerSecret = requireRelayerSecret();
  const built = await buildSimulateSignContractPayment({
    relayerSecret,
    contractAccountId: opts.contractAccountId,
    sessionSecret: opts.sessionSecret,
    destination: opts.destination,
    amountXlm: opts.amount,
    submit: false,
  });

  let retryCount = opts.startRetry;
  let lastHash: string | undefined;

  for (;;) {
    await prisma.transaction.update({
      where: { id: opts.transactionId },
      data: { status: "SUBMITTING", retryCount },
    });
    try {
      const { hash } = await submitSignedSorobanXdr({
        signedXdr: built.signedXdr,
        knownHash: lastHash,
      });
      return { hash, retryCount, signedXdr: built.signedXdr };
    } catch (err) {
      const cls: SorobanFailureClass =
        err && typeof err === "object" && "failureClass" in err
          ? ((err as { failureClass: SorobanFailureClass }).failureClass)
          : classifySorobanFailure(
              err instanceof Error ? err.message : String(err)
            );
      if (
        err &&
        typeof err === "object" &&
        "hash" in err &&
        typeof (err as { hash?: string }).hash === "string"
      ) {
        lastHash = (err as { hash: string }).hash;
      }
      if (!isRetryableSorobanFailure(cls) || !canRetrySubmit(retryCount)) {
        throw Object.assign(
          err instanceof Error ? err : new Error(String(err)),
          { failureClass: cls }
        );
      }
      retryCount = nextRetryCount(retryCount);
      if (retryCount > MAX_TECHNICAL_RETRIES) throw err;
    }
  }
}

export type TransferInput = {
  userId: string;
  sessionId: string;
  recipient: string;
  asset: string;
  amount: string;
  idempotencyKey?: string;
  /** Policy action to evaluate (default transfer). */
  policyAction?: string;
  /** Transaction record action (default transfer). */
  recordAction?: string;
};

/**
 * Full transfer lifecycle: resolve → policy → approve/auto → sign → submit.
 * Final submit branches on custody mode; policy/idempotency unchanged.
 */
export async function executeTransfer(input: TransferInput) {
  const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();
  const policyAction = input.policyAction?.trim() || "transfer";
  const recordAction = input.recordAction?.trim() || "transfer";

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

  const contractMode = isContractCustody(smartAccount);
  if (contractMode) {
    if (!smartAccount.contractRef?.startsWith("C")) {
      throw Object.assign(new Error("contract account not deployed"), {
        status: 400,
      });
    }
    if (!session.encryptedSessionKey || !isSessionActive(session)) {
      throw Object.assign(
        new Error("session not active on-chain — authorize with Freighter first"),
        { status: 403 }
      );
    }
  } else if (!smartAccount.publicKey || !smartAccount.encryptedSecret) {
    throw Object.assign(new Error("smart account not linked"), { status: 400 });
  }

  const contacts = await prisma.contact.findMany({
    where: { userId: input.userId },
  });
  const resolved = resolveRecipient(
    input.recipient,
    contacts.map((c) => ({
      id: c.id,
      name: c.name,
      stellarAddress: c.stellarAddress,
      verified: c.verified,
    }))
  );
  if (!resolved.ok) {
    throw Object.assign(new Error(resolved.message), {
      status: resolved.reason === "ambiguous" ? 409 : 400,
      resolve: resolved,
    });
  }

  let tx;
  try {
    tx = await prisma.transaction.create({
      data: {
        userId: input.userId,
        sessionId: session.id,
        idempotencyKey,
        action: recordAction,
        asset: input.asset,
        amount: input.amount,
        recipient: resolved.stellarAddress,
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

  const spent = await spentToday(session.id, input.asset);
  const policy = evaluatePolicy(
    {
      action: policyAction,
      asset: input.asset,
      amount: input.amount,
      recipient: resolved.stellarAddress,
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
    await writeAudit(input.userId, "transfer_rejected", {
      transactionId: tx.id,
      reason: policy.reason,
      custodyMode: contractMode ? "contract" : "legacy",
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
    await writeAudit(input.userId, "transfer_pending_approval", {
      transactionId: tx.id,
      approvalId: approval.id,
      custodyMode: contractMode ? "contract" : "legacy",
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

  return finalizeAndSubmit(tx.id, {
    destination: resolved.stellarAddress,
    amount: input.amount,
    userId: input.userId,
  });
}

export async function finalizeAndSubmit(
  transactionId: string,
  opts: { destination: string; amount: string; userId: string }
) {
  let tx = await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: "SIGNING" },
  });

  const smartAccount = await prisma.smartAccount.findUnique({
    where: { userId: opts.userId },
  });
  if (!smartAccount) {
    throw Object.assign(new Error("smart account missing"), { status: 400 });
  }

  const contractMode = isContractCustody(smartAccount);
  // Do not fall back to contractRef inference — custodyMode is authoritative.
  const mode = contractMode ? "soroban_contract" : "interim_g_account";

  try {
    let hash: string;
    let retryCount: number;

    if (mode === "soroban_contract") {
      if (!smartAccount.contractRef?.startsWith("C") || !tx.sessionId) {
        throw new Error("contract custody requires C-account and session");
      }
      const session = await prisma.aiSession.findFirst({
        where: { id: tx.sessionId, userId: opts.userId },
      });
      if (!session?.encryptedSessionKey || !isSessionActive(session)) {
        throw Object.assign(new Error("session not active for contract spend"), {
          status: 403,
        });
      }
      let sessionSecret: string;
      try {
        sessionSecret = decryptSecret(session.encryptedSessionKey);
      } catch {
        throw new Error("failed to unlock session key");
      }

      const result = await submitContractWithRetry({
        transactionId,
        contractAccountId: smartAccount.contractRef,
        sessionSecret,
        destination: opts.destination,
        amount: opts.amount,
        startRetry: tx.retryCount,
      });
      hash = result.hash;
      retryCount = result.retryCount;

      tx = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "SUCCESS",
          stellarTransactionHash: hash,
          retryCount,
          completedAt: new Date(),
        },
      });
      await writeAudit(opts.userId, "transfer_success", {
        transactionId: tx.id,
        hash,
        custodyMode: "contract",
        contractId: smartAccount.contractRef,
        sessionId: session.id,
        contractVersion: smartAccount.contractVersion,
        // never log secrets / signed xdr
      });
    } else {
      if (!smartAccount.encryptedSecret) {
        throw new Error("legacy custody missing encrypted secret");
      }
      let secret: string;
      try {
        secret = decryptSecret(smartAccount.encryptedSecret);
      } catch {
        throw new Error("failed to unlock allocation account");
      }
      const result = await submitLegacyWithRetry(
        transactionId,
        secret,
        opts.destination,
        opts.amount,
        tx.retryCount
      );
      hash = result.hash;
      retryCount = result.retryCount;

      tx = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: "SUCCESS",
          stellarTransactionHash: hash,
          retryCount,
          completedAt: new Date(),
        },
      });
      await writeAudit(opts.userId, "transfer_success", {
        transactionId: tx.id,
        hash,
        custodyMode: "legacy",
      });
    }

    await bumpMonthlyUsage(opts.userId, opts.amount);
    return {
      transaction: toTxView(tx),
      policy: { decision: "AUTO_EXECUTE" as const },
      idempotentReplay: false,
    };
  } catch (err) {
    const failureClass =
      err && typeof err === "object" && "failureClass" in err
        ? (err as { failureClass: string }).failureClass
        : undefined;
    tx = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "FAILED", completedAt: new Date() },
    });
    await writeAudit(opts.userId, "transfer_failed", {
      transactionId: tx.id,
      error: err instanceof Error ? err.message : "submit failed",
      custodyMode: contractMode ? "contract" : "legacy",
      contractId: smartAccount.contractRef,
      authFailureReason: failureClass,
      contractVersion: smartAccount.contractVersion,
    });
    throw Object.assign(
      new Error(err instanceof Error ? err.message : "submit failed"),
      { status: 502, transaction: toTxView(tx) }
    );
  }
}

export async function approvePendingTransfer(
  userId: string,
  approvalId: string
) {
  const approval = await prisma.approvalRequest.findFirst({
    where: { id: approvalId, userId },
  });
  if (!approval?.transactionId) {
    throw Object.assign(new Error("approval not found"), { status: 404 });
  }
  if (approval.status !== "pending") {
    throw Object.assign(new Error("approval already resolved"), { status: 409 });
  }
  if (approval.expiresAt <= new Date()) {
    await prisma.approvalRequest.update({
      where: { id: approval.id },
      data: { status: "expired", resolvedAt: new Date() },
    });
    await prisma.transaction.update({
      where: { id: approval.transactionId },
      data: { status: "EXPIRED", completedAt: new Date() },
    });
    throw Object.assign(new Error("approval expired"), { status: 410 });
  }

  const tx = await prisma.transaction.findFirst({
    where: { id: approval.transactionId, userId },
  });
  if (!tx || tx.status !== "PENDING_APPROVAL") {
    throw Object.assign(new Error("transaction not pending approval"), {
      status: 409,
    });
  }

  const smartAccount = await prisma.smartAccount.findUnique({
    where: { userId },
  });
  if (!smartAccount || !tx.recipient || !tx.amount) {
    throw Object.assign(new Error("cannot execute transfer"), { status: 400 });
  }

  await prisma.approvalRequest.update({
    where: { id: approval.id },
    data: { status: "approved", resolvedAt: new Date() },
  });
  await prisma.transaction.update({
    where: { id: tx.id },
    data: {
      status: "AUTO_APPROVED",
      policyDecision: "PENDING_APPROVAL→APPROVED",
    },
  });

  if (tx.action === "execute_swap") {
    const { finalizeSwapSubmit } = await import("./swap-service.js");
    return finalizeSwapSubmit(tx.id, {
      assetIn: tx.asset ?? "XLM",
      assetOut: tx.recipient,
      amount: tx.amount,
      userId,
    });
  }

  return finalizeAndSubmit(tx.id, {
    destination: tx.recipient,
    amount: tx.amount,
    userId,
  });
}

export async function rejectPendingTransfer(
  userId: string,
  approvalId: string
) {
  const approval = await prisma.approvalRequest.findFirst({
    where: { id: approvalId, userId },
  });
  if (!approval?.transactionId) {
    throw Object.assign(new Error("approval not found"), { status: 404 });
  }
  if (approval.status !== "pending") {
    throw Object.assign(new Error("approval already resolved"), { status: 409 });
  }

  await prisma.approvalRequest.update({
    where: { id: approval.id },
    data: { status: "rejected", resolvedAt: new Date() },
  });
  const tx = await prisma.transaction.update({
    where: { id: approval.transactionId },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
  await writeAudit(userId, "transfer_approval_rejected", {
    transactionId: tx.id,
    approvalId,
  });
  return { transaction: toTxView(tx) };
}
