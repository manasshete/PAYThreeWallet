import { Router } from "express";
import { prisma } from "@pay3/database";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const auditRouter = Router();
auditRouter.use(requireAuth);

auditRouter.get("/", async (req, res) => {
  const { userId } = req as AuthedRequest;
  const logs = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      metadata: l.metadata,
      createdAt: l.createdAt.toISOString(),
    })),
  });
});

export const usageRouter = Router();
usageRouter.use(requireAuth);

usageRouter.get("/", async (req, res) => {
  const { userId } = req as AuthedRequest;
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const row = await prisma.usageRecord.findUnique({
    where: { userId_month: { userId, month } },
  });
  res.json({
    usage: {
      month,
      txCount: row?.txCount ?? 0,
      // Field name is historical; value is XLM volume for MVP
      volume: row?.volumeUsd ?? "0",
      asset: "XLM",
    },
  });
});
