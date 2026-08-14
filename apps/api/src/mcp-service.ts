/**
 * Shared MCP tool implementations (REST + Streamable HTTP).
 */
import { prisma } from "@pay3/database";
import { evaluatePolicy } from "@pay3/policy-engine";
import { isSessionActive, type SessionPolicyRules } from "@pay3/session-manager";
import { getAccountBalances, getAccountPayments } from "@pay3/stellar";
import { executeTransfer, toTxView } from "./transfer-service.js";
import { executeSwap } from "./swap-service.js";
import { getSwapQuote, SoroswapError, type TradeType } from "./soroswap.js";
import { executeX402Fetch, X402Error } from "./x402-service.js";

export type McpSessionCtx = {
  userId: string;
  sessionId: string;
};

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

export type McpToolResult = {
  status: number;
  body: unknown;
};

export async function mcpGetBalance(
  ctx: McpSessionCtx,
  assetFilter?: string | null
): Promise<McpToolResult> {
  const session = await prisma.aiSession.findFirst({
    where: { id: ctx.sessionId, userId: ctx.userId },
    include: { policy: true },
  });
  if (!session) return { status: 404, body: { error: "session not found" } };

  const rules = asRules(session.policy?.rulesJson);
  if (!rules) return { status: 400, body: { error: "session has no policy" } };

  const policy = evaluatePolicy(
    { action: "get_balance" },
    { rules, sessionActive: isSessionActive(session) }
  );
  if (policy.decision === "REJECTED") {
    return { status: 403, body: { error: policy.reason, policy } };
  }

  const smartAccount = await prisma.smartAccount.findUnique({
    where: { userId: ctx.userId },
  });
  if (!smartAccount?.publicKey) {
    return { status: 400, body: { error: "smart account not linked" } };
  }

  const balances = await getAccountBalances(smartAccount.publicKey);
  const filter = assetFilter ? assetFilter.toUpperCase() : null;
  const filtered = filter
    ? balances.filter((b) => b.asset.toUpperCase().startsWith(filter))
    : balances;

  return {
    status: 200,
    body: {
      publicKey: smartAccount.publicKey,
      balances: filtered,
      policy: policy.decision,
    },
  };
}

export async function mcpTransfer(
  ctx: McpSessionCtx,
  args: {
    recipient: string;
    asset?: string;
    amount: string;
    idempotencyKey?: string;
  }
): Promise<McpToolResult> {
  const recipient = String(args.recipient ?? "").trim();
  const asset = String(args.asset ?? "XLM").trim();
  const amount = String(args.amount ?? "").trim();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : undefined;

  if (!recipient || !amount) {
    return { status: 400, body: { error: "recipient and amount required" } };
  }

  try {
    const result = await executeTransfer({
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      recipient,
      asset,
      amount,
      idempotencyKey,
    });
    const status =
      result.transaction.status === "PENDING_APPROVAL"
        ? 202
        : result.transaction.status === "REJECTED"
          ? 403
          : result.transaction.status === "SUCCESS"
            ? 200
            : 201;
    return { status, body: result };
  } catch (err: unknown) {
    const e = err as {
      status?: number;
      message?: string;
      transaction?: unknown;
      resolve?: unknown;
    };
    return {
      status: e.status ?? 500,
      body: {
        error: e.message ?? "transfer failed",
        transaction: e.transaction,
        resolve: e.resolve,
      },
    };
  }
}

export async function mcpGetHistory(ctx: McpSessionCtx): Promise<McpToolResult> {
  const session = await prisma.aiSession.findFirst({
    where: { id: ctx.sessionId, userId: ctx.userId },
    include: { policy: true },
  });
  if (!session) return { status: 404, body: { error: "session not found" } };

  const rules = asRules(session.policy?.rulesJson);
  if (!rules) return { status: 400, body: { error: "session has no policy" } };

  const policy = evaluatePolicy(
    { action: "get_transaction_history" },
    { rules, sessionActive: isSessionActive(session) }
  );
  if (policy.decision === "REJECTED") {
    return { status: 403, body: { error: policy.reason, policy } };
  }

  const txs = await prisma.transaction.findMany({
    where: { userId: ctx.userId, sessionId: ctx.sessionId },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const smartAccount = await prisma.smartAccount.findUnique({
    where: { userId: ctx.userId },
  });
  let horizon: unknown[] = [];
  if (smartAccount?.publicKey) {
    horizon = await getAccountPayments(smartAccount.publicKey, 15);
  }

  return {
    status: 200,
    body: {
      transactions: txs.map(toTxView),
      horizon,
      policy: policy.decision,
    },
  };
}

export async function mcpGetSwapQuote(
  ctx: McpSessionCtx,
  args: {
    assetIn: string;
    assetOut: string;
    amount: string;
    tradeType?: string;
  }
): Promise<McpToolResult> {
  const session = await prisma.aiSession.findFirst({
    where: { id: ctx.sessionId, userId: ctx.userId },
    include: { policy: true },
  });
  if (!session) return { status: 404, body: { error: "session not found" } };

  const rules = asRules(session.policy?.rulesJson);
  if (!rules) return { status: 400, body: { error: "session has no policy" } };

  const policy = evaluatePolicy(
    { action: "get_swap_quote" },
    { rules, sessionActive: isSessionActive(session) }
  );
  if (policy.decision === "REJECTED") {
    return { status: 403, body: { error: policy.reason, policy } };
  }

  const tradeType: TradeType | undefined =
    args.tradeType?.toUpperCase() === "EXACT_OUT"
      ? "EXACT_OUT"
      : args.tradeType?.toUpperCase() === "EXACT_IN"
        ? "EXACT_IN"
        : undefined;

  try {
    const quote = await getSwapQuote({
      assetIn: args.assetIn,
      assetOut: args.assetOut,
      amount: args.amount,
      tradeType,
    });
    return {
      status: 200,
      body: { quote, policy: policy.decision },
    };
  } catch (err) {
    if (err instanceof SoroswapError) {
      return { status: err.status, body: { error: err.message } };
    }
    return {
      status: 500,
      body: {
        error: err instanceof Error ? err.message : "swap quote failed",
      },
    };
  }
}

export async function mcpExecuteSwap(
  ctx: McpSessionCtx,
  args: {
    assetIn: string;
    assetOut: string;
    amount: string;
    tradeType?: string;
    slippageBps?: number;
    idempotencyKey?: string;
  }
): Promise<McpToolResult> {
  const assetIn = String(args.assetIn ?? "").trim();
  const assetOut = String(args.assetOut ?? "").trim();
  const amount = String(args.amount ?? "").trim();
  if (!assetIn || !assetOut || !amount) {
    return {
      status: 400,
      body: { error: "asset_in, asset_out, and amount required" },
    };
  }

  const tradeType: TradeType | undefined =
    args.tradeType?.toUpperCase() === "EXACT_OUT"
      ? "EXACT_OUT"
      : args.tradeType?.toUpperCase() === "EXACT_IN"
        ? "EXACT_IN"
        : undefined;

  try {
    const result = await executeSwap({
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      assetIn,
      assetOut,
      amount,
      tradeType,
      slippageBps: args.slippageBps,
      idempotencyKey: args.idempotencyKey,
    });
    const status =
      result.transaction.status === "PENDING_APPROVAL"
        ? 202
        : result.transaction.status === "REJECTED"
          ? 403
          : result.transaction.status === "SUCCESS"
            ? 200
            : 201;
    return { status, body: result };
  } catch (err: unknown) {
    const e = err as {
      status?: number;
      message?: string;
      transaction?: unknown;
    };
    return {
      status: e.status ?? 500,
      body: {
        error: e.message ?? "swap failed",
        transaction: e.transaction,
      },
    };
  }
}

export async function mcpX402Fetch(
  ctx: McpSessionCtx,
  args: {
    url: string;
    maxAmount?: string;
    idempotencyKey?: string;
  }
): Promise<McpToolResult> {
  const url = String(args.url ?? "").trim();
  if (!url) {
    return { status: 400, body: { error: "url required" } };
  }

  const session = await prisma.aiSession.findFirst({
    where: { id: ctx.sessionId, userId: ctx.userId },
    include: { policy: true },
  });
  if (!session) return { status: 404, body: { error: "session not found" } };

  const rules = asRules(session.policy?.rulesJson);
  if (!rules) return { status: 400, body: { error: "session has no policy" } };

  if (!isSessionActive(session)) {
    return { status: 403, body: { error: "session not active" } };
  }

  if (!rules.allowedActions.map((a) => a.toLowerCase()).includes("x402_fetch")) {
    return {
      status: 403,
      body: { error: "x402_fetch is not allowed for this session" },
    };
  }

  try {
    const result = await executeX402Fetch({
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      url,
      maxAmount: args.maxAmount ? String(args.maxAmount) : undefined,
      idempotencyKey: args.idempotencyKey
        ? String(args.idempotencyKey)
        : undefined,
    });
    return {
      status: result.status,
      body: {
        paid: result.paid,
        paymentTxHash: result.paymentTxHash,
        response: result.body,
      },
    };
  } catch (err) {
    if (err instanceof X402Error) {
      return { status: err.status, body: { error: err.message } };
    }
    return {
      status: 500,
      body: {
        error: err instanceof Error ? err.message : "x402_fetch failed",
      },
    };
  }
}
