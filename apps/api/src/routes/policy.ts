import { Router } from "express";
import { prisma } from "@pay3/database";
import {
  evaluatePolicy,
  policyPreset,
  type PolicyDecision,
  type PolicyRequest,
} from "@pay3/policy-engine";
import {
  isSessionActive,
  type SessionPolicyRules,
} from "@pay3/session-manager";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const policyRouter = Router();

policyRouter.use(requireAuth);

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

async function spentTodayForSession(
  sessionId: string,
  asset: string
): Promise<string> {
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

policyRouter.get("/presets", (_req, res) => {
  res.json({
    presets: {
      conservative: policyPreset("conservative"),
      balanced: policyPreset("balanced"),
      custom: policyPreset("custom"),
    },
  });
});

/**
 * Evaluate a hypothetical or real request against a session's policy.
 * Body: { sessionId, action, asset?, amount?, recipient? }
 */
policyRouter.post("/evaluate", async (req, res) => {
  const { userId } = req as AuthedRequest;
  const sessionId = String(req.body?.sessionId ?? "").trim();
  const action = String(req.body?.action ?? "").trim();

  if (!sessionId || !action) {
    res.status(400).json({ error: "sessionId and action required" });
    return;
  }

  const session = await prisma.aiSession.findFirst({
    where: { id: sessionId, userId },
    include: { policy: true },
  });

  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }

  // Lazy expire
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

  const rules = asRules(session.policy?.rulesJson);
  if (!rules) {
    res.status(400).json({ error: "session has no usable policy rules" });
    return;
  }

  const request: PolicyRequest = {
    action,
    asset: req.body?.asset ? String(req.body.asset) : undefined,
    amount: req.body?.amount ? String(req.body.amount) : undefined,
    recipient: req.body?.recipient ? String(req.body.recipient) : undefined,
  };

  const spentToday = await spentTodayForSession(
    session.id,
    request.asset ?? rules.asset
  );

  const result = evaluatePolicy(request, {
    rules,
    sessionActive: isSessionActive(session),
    spentToday,
  });

  res.json({
    ...result,
    sessionId: session.id,
    clientType: session.clientType,
    spentToday,
    rules,
  });
});

export type { PolicyDecision };
