import { Router } from "express";
import { prisma } from "@pay3/database";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  approvePendingTransfer,
  rejectPendingTransfer,
  toTxView,
} from "../transfer-service.js";

export const approvalsRouter = Router();

approvalsRouter.use(requireAuth);

approvalsRouter.get("/", async (req, res) => {
  const { userId } = req as AuthedRequest;
  const now = new Date();

  // Expire stale approvals
  const stale = await prisma.approvalRequest.findMany({
    where: { userId, status: "pending", expiresAt: { lte: now } },
  });
  for (const a of stale) {
    await prisma.approvalRequest.update({
      where: { id: a.id },
      data: { status: "expired", resolvedAt: now },
    });
    if (a.transactionId) {
      await prisma.transaction.updateMany({
        where: { id: a.transactionId, status: "PENDING_APPROVAL" },
        data: { status: "EXPIRED", completedAt: now },
      });
    }
  }

  const approvals = await prisma.approvalRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const txIds = approvals
    .map((a) => a.transactionId)
    .filter((id): id is string => Boolean(id));
  const txs = await prisma.transaction.findMany({
    where: { id: { in: txIds } },
  });
  const byId = new Map(txs.map((t) => [t.id, t]));

  res.json({
    approvals: approvals.map((a) => ({
      id: a.id,
      transactionId: a.transactionId,
      status: a.status,
      expiresAt: a.expiresAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
      transaction: a.transactionId
        ? toTxView(byId.get(a.transactionId)!)
        : null,
    })),
  });
});

approvalsRouter.post("/:id/approve", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const id = String(req.params.id);
  try {
    const result = await approvePendingTransfer(userId, id);
    res.json(result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; transaction?: unknown };
    res.status(e.status ?? 500).json({
      error: e.message ?? "approve failed",
      transaction: e.transaction,
    });
  }
});

approvalsRouter.post("/:id/reject", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const id = String(req.params.id);
  try {
    const result = await rejectPendingTransfer(userId, id);
    res.json(result);
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    res.status(e.status ?? 500).json({
      error: e.message ?? "reject failed",
    });
  }
});
