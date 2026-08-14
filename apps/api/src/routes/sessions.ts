import { Router } from "express";
import { createHash } from "node:crypto";
import { prisma } from "@pay3/database";
import {
  buildSessionAuthMessage,
  computeExpiresAt,
  createMcpToken,
  createSessionKeypair,
  defaultSessionRules,
  isSessionActive,
  normalizeClientType,
  permissionSummary,
  type SessionCreateInput,
  type SessionPolicyRules,
} from "@pay3/session-manager";
import { encryptSecret } from "../crypto.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  createChallenge,
  findChallengeByNonce,
  markChallengeUsed,
} from "../auth-store.js";
import { verifySep53Signature } from "../sep53.js";
import { randomBytes } from "node:crypto";
import { CHALLENGE_TTL_MS } from "@pay3/shared";
import {
  estimateExpiresLedger,
  isContractCustody,
  prepareAddSessionTx,
  prepareRevokeSessionTx,
  assertSessionAdminTx,
  submitOwnerSignedTx,
} from "../onchain-session.js";
import { getRpcServer } from "@pay3/stellar";

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

function parseRules(body: unknown): SessionPolicyRules {
  const defaults = defaultSessionRules();
  const b = (body ?? {}) as Record<string, unknown>;
  const allowedActions = Array.isArray(b.allowedActions)
    ? b.allowedActions.map(String)
    : defaults.allowedActions;

  return {
    durationHours: Math.min(
      168,
      Math.max(1, Number(b.durationHours ?? defaults.durationHours))
    ),
    dailyBudget: String(b.dailyBudget ?? defaults.dailyBudget),
    asset: String(b.asset ?? defaults.asset),
    perTxMax: String(b.perTxMax ?? defaults.perTxMax),
    approvalAbove: String(b.approvalAbove ?? defaults.approvalAbove),
    allowedActions,
    blockedNotes: Array.isArray(b.blockedNotes)
      ? b.blockedNotes.map(String)
      : defaults.blockedNotes,
  };
}

function policyVersion(rules: SessionPolicyRules): string {
  return createHash("sha256")
    .update(JSON.stringify(rules))
    .digest("hex")
    .slice(0, 16);
}

function toSessionView(s: {
  id: string;
  clientType: string;
  label?: string | null;
  sessionPublicKey?: string | null;
  status: string;
  expiresAt: Date | null;
  expiresLedger?: number | null;
  revokedAt: Date | null;
  createdAt: Date;
  onchainRegisterTxHash?: string | null;
  onchainRevokeTxHash?: string | null;
  policy: { name: string; rulesJson: unknown } | null;
}) {
  const active = isSessionActive(s);
  const expired =
    s.status === "active" && s.expiresAt && s.expiresAt <= new Date();
  return {
    id: s.id,
    clientType: s.clientType,
    label: s.label ?? null,
    sessionPublicKey: s.sessionPublicKey ?? null,
    status: s.revokedAt
      ? s.status === "revocation_pending"
        ? "revocation_pending"
        : "revoked"
      : expired
        ? "expired"
        : s.status,
    expiresAt: s.expiresAt?.toISOString() ?? null,
    expiresLedger: s.expiresLedger ?? null,
    revokedAt: s.revokedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    policy: s.policy
      ? { name: s.policy.name, rules: s.policy.rulesJson }
      : null,
    active,
    onchainRegisterTxHash: s.onchainRegisterTxHash ?? null,
    onchainRevokeTxHash: s.onchainRevokeTxHash ?? null,
    needsOnchainAuth: s.status === "pending_onchain",
  };
}

sessionsRouter.get("/", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const sessions = await prisma.aiSession.findMany({
    where: { userId },
    include: { policy: true },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  for (const s of sessions) {
    if (
      s.status === "active" &&
      !s.revokedAt &&
      s.expiresAt &&
      s.expiresAt <= now
    ) {
      await prisma.aiSession.update({
        where: { id: s.id },
        data: { status: "expired" },
      });
      s.status = "expired";
    }
  }

  res.json({ sessions: sessions.map(toSessionView) });
});

sessionsRouter.post("/preview", async (req, res) => {
  const clientType = normalizeClientType(String(req.body?.clientType ?? "claude"));
  const rules = parseRules(req.body?.rules ?? req.body);
  const input: SessionCreateInput = {
    clientType,
    label: req.body?.label ? String(req.body.label) : undefined,
    rules,
  };
  const summary = permissionSummary(input);
  res.json({
    clientType,
    label: input.label ?? null,
    rules,
    ...summary,
  });
});

sessionsRouter.post("/challenge", async (req, res) => {
  const { walletPublicKey } = req as AuthedRequest;
  const clientType = normalizeClientType(String(req.body?.clientType ?? "claude"));
  const rules = parseRules(req.body?.rules ?? req.body);
  const input: SessionCreateInput = {
    clientType,
    label: req.body?.label ? String(req.body.label) : undefined,
    rules,
  };

  const nonce = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await createChallenge(walletPublicKey, nonce, expiresAt);

  const message = buildSessionAuthMessage(input, nonce);
  const summary = permissionSummary(input);

  res.json({
    nonce,
    message,
    expiresAt: expiresAt.toISOString(),
    preview: { clientType, label: input.label ?? null, rules, ...summary },
  });
});

sessionsRouter.post("/", async (req, res) => {
  const { userId, walletPublicKey } = req as unknown as AuthedRequest;
  const signature = String(req.body?.signature ?? "").trim();
  const nonce = String(req.body?.nonce ?? "").trim();
  const clientType = normalizeClientType(String(req.body?.clientType ?? "claude"));
  const rules = parseRules(req.body?.rules ?? req.body);
  const label = req.body?.label ? String(req.body.label) : `${clientType} session`;

  if (!signature || !nonce) {
    res.status(400).json({ error: "signature and nonce required" });
    return;
  }

  const input: SessionCreateInput = { clientType, label, rules };
  const message = buildSessionAuthMessage(input, nonce);

  try {
    const challenge = await findChallengeByNonce(nonce);
    if (
      !challenge ||
      challenge.publicKey !== walletPublicKey ||
      challenge.usedAt ||
      challenge.expiresAt < new Date()
    ) {
      res.status(401).json({ error: "invalid or expired challenge" });
      return;
    }

    if (!verifySep53Signature(walletPublicKey, message, signature)) {
      res.status(401).json({ error: "signature verification failed" });
      return;
    }

    await markChallengeUsed(challenge.id, nonce);

    const { publicKey: sessionPublicKey, secret } = createSessionKeypair();
    const encryptedSessionKey = encryptSecret(secret);
    const { token: mcpToken, hash: mcpTokenHash } = createMcpToken();
    const now = new Date();
    const expiresAt = computeExpiresAt(now, rules.durationHours);

    const smartAccount = await prisma.smartAccount.findUnique({
      where: { userId },
    });
    const contractMode = smartAccount
      ? isContractCustody(smartAccount)
      : false;

    let expiresLedger: number | null = null;
    if (contractMode) {
      const latest = await getRpcServer().getLatestLedger();
      expiresLedger = estimateExpiresLedger(
        latest.sequence,
        rules.durationHours
      );
    }

    const policy = await prisma.policy.create({
      data: {
        userId,
        name: `${clientType}-${now.toISOString().slice(0, 10)}`,
        rulesJson: rules,
      },
    });

    // Existing active DB sessions are never silently promoted for contract users —
    // new sessions start pending_onchain until Freighter add_session confirms.
    const session = await prisma.aiSession.create({
      data: {
        userId,
        policyId: policy.id,
        clientType,
        label,
        sessionPublicKey,
        encryptedSessionKey,
        mcpTokenHash,
        status: contractMode ? "pending_onchain" : "active",
        expiresAt,
        expiresLedger,
        policyVersion: policyVersion(rules),
      },
      include: { policy: true },
    });

    let onchain: { unsignedXdr: string; expiresLedger: number } | null = null;
    if (
      contractMode &&
      smartAccount?.contractRef?.startsWith("C") &&
      sessionPublicKey &&
      expiresLedger != null
    ) {
      onchain = await prepareAddSessionTx({
        contractId: smartAccount.contractRef,
        ownerGAddress: walletPublicKey,
        sessionPublicKey,
        rules,
        expiresLedger,
      });
    }

    res.status(201).json({
      session: toSessionView(session),
      mcpToken,
      mcpConfigHint: {
        note: "Copy this token now — it is shown only once.",
        hostedMcp: {
          url: "https://pay3-api.vercel.app/mcp",
          headers: { Authorization: "Bearer <token>" },
        },
      },
      onchainRegister: onchain
        ? {
            unsignedXdr: onchain.unsignedXdr,
            expiresLedger: onchain.expiresLedger,
            note: "Sign with Freighter then POST /sessions/:id/onchain-confirm",
          }
        : null,
    });
  } catch (err) {
    console.error("sessions create failed:", err);
    res.status(500).json({ error: "failed to create session" });
  }
});

/** Re-prepare add_session XDR if client needs to retry Freighter signing. */
sessionsRouter.post("/:id/onchain-prepare", async (req, res) => {
  const { userId, walletPublicKey } = req as unknown as AuthedRequest;
  const id = String(req.params.id);

  const session = await prisma.aiSession.findFirst({
    where: { id, userId },
    include: { policy: true },
  });
  if (!session?.sessionPublicKey) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  if (session.status !== "pending_onchain") {
    res.status(409).json({ error: "session is not pending on-chain registration" });
    return;
  }

  const smartAccount = await prisma.smartAccount.findUnique({
    where: { userId },
  });
  if (!smartAccount?.contractRef?.startsWith("C")) {
    res.status(400).json({ error: "contract custody not enabled" });
    return;
  }

  const rules = parseRules(session.policy?.rulesJson ?? {});
  const latest = await getRpcServer().getLatestLedger();
  const expiresLedger =
    session.expiresLedger ??
    estimateExpiresLedger(latest.sequence, rules.durationHours);

  try {
    const prepared = await prepareAddSessionTx({
      contractId: smartAccount.contractRef,
      ownerGAddress: walletPublicKey,
      sessionPublicKey: session.sessionPublicKey,
      rules,
      expiresLedger,
    });
    await prisma.aiSession.update({
      where: { id },
      data: { expiresLedger: prepared.expiresLedger },
    });
    res.json({
      unsignedXdr: prepared.unsignedXdr,
      expiresLedger: prepared.expiresLedger,
    });
  } catch (err) {
    console.error("onchain-prepare failed:", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "prepare failed",
    });
  }
});

sessionsRouter.post("/:id/onchain-confirm", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const id = String(req.params.id);
  const signedXdr = String(req.body?.signedXdr ?? "").trim();
  if (!signedXdr) {
    res.status(400).json({ error: "signedXdr required" });
    return;
  }

  const session = await prisma.aiSession.findFirst({
    where: { id, userId },
    include: { policy: true },
  });
  if (!session?.sessionPublicKey) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  if (
    session.status !== "pending_onchain" &&
    session.status !== "revocation_pending"
  ) {
    res.status(409).json({ error: `unexpected status ${session.status}` });
    return;
  }

  const smartAccount = await prisma.smartAccount.findUnique({
    where: { userId },
  });
  if (!smartAccount?.contractRef?.startsWith("C")) {
    res.status(400).json({ error: "contract custody not enabled" });
    return;
  }

  const method =
    session.status === "pending_onchain" ? "add_session" : "revoke_session";
  try {
    assertSessionAdminTx({
      signedXdr,
      contractId: smartAccount.contractRef,
      method,
      sessionPublicKey: session.sessionPublicKey,
    });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "invalid session admin tx",
    });
    return;
  }

  try {
    const { hash } = await submitOwnerSignedTx(signedXdr);
    const updated =
      session.status === "pending_onchain"
        ? await prisma.aiSession.update({
            where: { id },
            data: {
              status: "active",
              onchainRegisterTxHash: hash,
            },
            include: { policy: true },
          })
        : await prisma.aiSession.update({
            where: { id },
            data: {
              status: "revoked",
              onchainRevokeTxHash: hash,
            },
            include: { policy: true },
          });
    res.json({ session: toSessionView(updated), hash });
  } catch (err) {
    console.error("onchain-confirm failed:", err);
    res.status(502).json({
      error: err instanceof Error ? err.message : "confirm failed",
    });
  }
});

sessionsRouter.post("/revoke-all", async (req, res) => {
  const { userId, walletPublicKey } = req as unknown as AuthedRequest;
  const smartAccount = await prisma.smartAccount.findUnique({
    where: { userId },
  });
  const contractMode = smartAccount
    ? isContractCustody(smartAccount)
    : false;

  const active = await prisma.aiSession.findMany({
    where: {
      userId,
      revokedAt: null,
      status: { in: ["active", "pending_onchain"] },
    },
  });

  // Fail closed immediately — MCP cannot spend after this.
  await prisma.aiSession.updateMany({
    where: {
      userId,
      id: { in: active.map((s) => s.id) },
    },
    data: {
      status: contractMode ? "revocation_pending" : "revoked",
      revokedAt: new Date(),
    },
  });

  const partial: { id: string; error?: string; unsignedXdr?: string }[] = [];
  if (contractMode && smartAccount?.contractRef?.startsWith("C")) {
    for (const s of active) {
      if (!s.sessionPublicKey || s.status === "pending_onchain") {
        await prisma.aiSession.update({
          where: { id: s.id },
          data: { status: "revoked" },
        });
        partial.push({ id: s.id });
        continue;
      }
      try {
        const prepared = await prepareRevokeSessionTx({
          contractId: smartAccount.contractRef,
          ownerGAddress: walletPublicKey,
          sessionPublicKey: s.sessionPublicKey,
        });
        partial.push({ id: s.id, unsignedXdr: prepared.unsignedXdr });
      } catch (err) {
        partial.push({
          id: s.id,
          error: err instanceof Error ? err.message : "revoke prepare failed",
        });
      }
    }
  }

  res.json({
    revoked: active.length,
    // Partial on-chain failures do not restore API access
    onchain: partial,
  });
});

sessionsRouter.post("/:id/revoke", async (req, res) => {
  const { userId, walletPublicKey } = req as unknown as AuthedRequest;
  const id = String(req.params.id);

  const session = await prisma.aiSession.findFirst({
    where: { id, userId },
    include: { policy: true },
  });
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }

  const smartAccount = await prisma.smartAccount.findUnique({
    where: { userId },
  });
  const contractMode = smartAccount
    ? isContractCustody(smartAccount)
    : false;

  // Fail closed in API immediately.
  const updated = await prisma.aiSession.update({
    where: { id },
    data: {
      status:
        contractMode && session.status === "active"
          ? "revocation_pending"
          : "revoked",
      revokedAt: new Date(),
    },
    include: { policy: true },
  });

  let onchainRevoke: { unsignedXdr: string } | null = null;
  if (
    contractMode &&
    smartAccount?.contractRef?.startsWith("C") &&
    session.sessionPublicKey &&
    session.status === "active"
  ) {
    try {
      onchainRevoke = await prepareRevokeSessionTx({
        contractId: smartAccount.contractRef,
        ownerGAddress: walletPublicKey,
        sessionPublicKey: session.sessionPublicKey,
      });
    } catch (err) {
      console.error("revoke prepare failed:", err);
    }
  }

  res.json({
    session: toSessionView(updated),
    onchainRevoke,
  });
});
