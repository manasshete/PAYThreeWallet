import { Router } from "express";
import { requireMcpAuth, type McpAuthedRequest } from "../middleware/mcp-auth.js";
import {
  mcpGetBalance,
  mcpGetHistory,
  mcpGetSwapQuote,
  mcpExecuteSwap,
  mcpTransfer,
  mcpX402Fetch,
} from "../mcp-service.js";

export const mcpRouter = Router();

mcpRouter.use(requireMcpAuth);

mcpRouter.get("/balance", async (req, res) => {
  const { userId, sessionId } = req as McpAuthedRequest;
  const asset = req.query.asset ? String(req.query.asset) : null;
  const result = await mcpGetBalance({ userId, sessionId }, asset);
  res.status(result.status).json(result.body);
});

mcpRouter.post("/transfer", async (req, res) => {
  const { userId, sessionId } = req as McpAuthedRequest;
  const result = await mcpTransfer(
    { userId, sessionId },
    {
      recipient: String(req.body?.recipient ?? ""),
      asset: req.body?.asset ? String(req.body.asset) : "XLM",
      amount: String(req.body?.amount ?? ""),
      idempotencyKey: req.body?.idempotencyKey
        ? String(req.body.idempotencyKey)
        : undefined,
    }
  );
  res.status(result.status).json(result.body);
});

mcpRouter.get("/history", async (req, res) => {
  const { userId, sessionId } = req as McpAuthedRequest;
  const result = await mcpGetHistory({ userId, sessionId });
  res.status(result.status).json(result.body);
});

mcpRouter.post("/swap-quote", async (req, res) => {
  const { userId, sessionId } = req as McpAuthedRequest;
  const tradeRaw = req.body?.tradeType ?? req.body?.trade_type;
  const result = await mcpGetSwapQuote(
    { userId, sessionId },
    {
      assetIn: String(req.body?.assetIn ?? req.body?.asset_in ?? ""),
      assetOut: String(req.body?.assetOut ?? req.body?.asset_out ?? ""),
      amount: String(req.body?.amount ?? ""),
      tradeType:
        tradeRaw != null && tradeRaw !== "" ? String(tradeRaw) : undefined,
    }
  );
  res.status(result.status).json(result.body);
});

mcpRouter.post("/swap", async (req, res) => {
  const { userId, sessionId } = req as McpAuthedRequest;
  const tradeRaw = req.body?.tradeType ?? req.body?.trade_type;
  const slipRaw = req.body?.slippageBps ?? req.body?.slippage_bps;
  const result = await mcpExecuteSwap(
    { userId, sessionId },
    {
      assetIn: String(req.body?.assetIn ?? req.body?.asset_in ?? ""),
      assetOut: String(req.body?.assetOut ?? req.body?.asset_out ?? ""),
      amount: String(req.body?.amount ?? ""),
      tradeType:
        tradeRaw != null && tradeRaw !== "" ? String(tradeRaw) : undefined,
      slippageBps:
        slipRaw != null && slipRaw !== "" ? Number(slipRaw) : undefined,
      idempotencyKey: req.body?.idempotencyKey
        ? String(req.body.idempotencyKey)
        : req.body?.idempotency_key
          ? String(req.body.idempotency_key)
          : undefined,
    }
  );
  res.status(result.status).json(result.body);
});

mcpRouter.post("/x402-fetch", async (req, res) => {
  const { userId, sessionId } = req as McpAuthedRequest;
  const result = await mcpX402Fetch(
    { userId, sessionId },
    {
      url: String(req.body?.url ?? ""),
      maxAmount:
        req.body?.maxAmount != null
          ? String(req.body.maxAmount)
          : req.body?.max_amount != null
            ? String(req.body.max_amount)
            : undefined,
      idempotencyKey: req.body?.idempotencyKey
        ? String(req.body.idempotencyKey)
        : req.body?.idempotency_key
          ? String(req.body.idempotency_key)
          : undefined,
    }
  );
  res.status(result.status).json(result.body);
});
