import { Router } from "express";
import { prisma } from "@pay3/database";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { executeTransfer, toTxView } from "../transfer-service.js";

export const transactionsRouter = Router();

transactionsRouter.use(requireAuth);

transactionsRouter.get("/", async (req, res) => {
  const { userId } = req as AuthedRequest;
  const txs = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ transactions: txs.map(toTxView) });
});

transactionsRouter.post("/transfer", async (req, res) => {
  const { userId } = req as AuthedRequest;
  const sessionId = String(req.body?.sessionId ?? "").trim();
  const recipient = String(req.body?.recipient ?? "").trim();
  const asset = String(req.body?.asset ?? "XLM").trim();
  const amount = String(req.body?.amount ?? "").trim();
  const idempotencyKey = req.body?.idempotencyKey
    ? String(req.body.idempotencyKey).trim()
    : undefined;

  if (!sessionId || !recipient || !amount) {
    res.status(400).json({ error: "sessionId, recipient, and amount required" });
    return;
  }

  if (asset.toUpperCase() !== "XLM") {
    res.status(400).json({
      error: "Only native XLM transfers are supported in this phase",
    });
    return;
  }

  try {
    const result = await executeTransfer({
      userId,
      sessionId,
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
          : 201;
    res.status(status).json(result);
  } catch (err: unknown) {
    const e = err as {
      status?: number;
      message?: string;
      transaction?: unknown;
      resolve?: unknown;
    };
    console.error("transfer failed:", e.message ?? err);
    res.status(e.status ?? 500).json({
      error: e.message ?? "transfer failed",
      transaction: e.transaction,
      resolve: e.resolve,
    });
  }
});
