/**
 * x402 paid API fetch: 402 challenge → policy-gated pay → retry with proof.
 */
import { randomUUID } from "node:crypto";
import { getHorizonServer } from "@pay3/stellar";
import { executeTransfer } from "./transfer-service.js";
import {
  buildX402PaymentHeader,
  parseX402Challenge,
  type X402Accept,
} from "./x402.js";

export class X402Error extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "X402Error";
    this.status = status;
  }
}

function allowedFetchHosts(): Set<string> {
  const fromEnv = (process.env.X402_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const defaults = ["localhost", "127.0.0.1", "pay3-api.vercel.app"];
  return new Set([...defaults, ...fromEnv]);
}

export function assertAllowedFetchUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new X402Error("Invalid URL", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new X402Error("Only http(s) URLs allowed", 400);
  }
  const host = parsed.hostname.toLowerCase();
  const allowed = allowedFetchHosts();
  if (!allowed.has(host) && !host.endsWith(".vercel.app")) {
    throw new X402Error(`Host not allowed for x402_fetch: ${host}`, 403);
  }
  return parsed;
}

function pickAccept(
  challenge: ReturnType<typeof parseX402Challenge>,
  maxAmount?: string
): X402Accept {
  if (!challenge?.accepts.length) {
    throw new X402Error("No payable x402 accept found in 402 response", 502);
  }
  const accept = challenge.accepts[0];
  if (maxAmount) {
    const max = Number(maxAmount);
    const need = Number(accept.amount);
    if (Number.isFinite(max) && Number.isFinite(need) && need > max) {
      throw new X402Error(
        `API requires ${accept.amount} ${accept.asset} but max_amount is ${maxAmount}`,
        403
      );
    }
  }
  return accept;
}

export async function executeX402Fetch(input: {
  userId: string;
  sessionId: string;
  url: string;
  maxAmount?: string;
  idempotencyKey?: string;
}): Promise<{
  status: number;
  paid: boolean;
  paymentTxHash?: string;
  body: unknown;
}> {
  const url = assertAllowedFetchUrl(input.url.trim()).toString();
  const first = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (first.status !== 402) {
    const body = await first.json().catch(() => ({}));
    return { status: first.status, paid: false, body };
  }

  const challengeJson = await first.json().catch(() => null);
  const challenge = parseX402Challenge(challengeJson);
  const accept = pickAccept(challenge, input.maxAmount?.trim());

  const payResult = await executeTransfer({
    userId: input.userId,
    sessionId: input.sessionId,
    recipient: accept.payTo,
    asset: accept.asset,
    amount: accept.amount,
    idempotencyKey: input.idempotencyKey?.trim() || randomUUID(),
    policyAction: "x402_fetch",
    recordAction: "x402_fetch",
  });

  const tx = payResult.transaction;
  if (tx.status === "PENDING_APPROVAL") {
    return {
      status: 202,
      paid: false,
      body: {
        message: "Payment requires human approval before API access",
        transaction: tx,
        x402: { url, accept },
      },
    };
  }
  if (tx.status !== "SUCCESS" || !tx.stellarTransactionHash) {
    return {
      status: 403,
      paid: false,
      body: {
        error: "x402 payment failed or was rejected",
        transaction: tx,
        policy: payResult.policy,
      },
    };
  }

  const proof = buildX402PaymentHeader(tx.stellarTransactionHash);
  const retry = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Payment": proof,
    },
  });
  const body = await retry.json().catch(() => ({}));
  return {
    status: retry.status,
    paid: true,
    paymentTxHash: tx.stellarTransactionHash,
    body,
  };
}

/** Verify a Stellar payment tx against x402 accept (demo gate). */
export async function verifyX402Payment(opts: {
  txHash: string;
  accept: X402Accept;
}): Promise<boolean> {
  try {
    const server = getHorizonServer();
    const tx = await server.transactions().transaction(opts.txHash).call();
    const ops = await server.operations().forTransaction(opts.txHash).call();
    for (const op of ops.records) {
      if (op.type !== "payment") continue;
      const payOp = op as { to?: string; amount?: string; asset_type?: string };
      if (payOp.to !== opts.accept.payTo) continue;
      if (payOp.asset_type !== "native" && opts.accept.asset === "XLM") continue;
      const amt = Number(payOp.amount);
      const need = Number(opts.accept.amount);
      if (Number.isFinite(amt) && Number.isFinite(need) && amt + 1e-9 >= need) {
        return tx.successful === true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
