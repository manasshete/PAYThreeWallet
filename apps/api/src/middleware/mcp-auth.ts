import type { NextFunction, Request, Response } from "express";
import { prisma } from "@pay3/database";
import { hashMcpToken, isSessionActive } from "@pay3/session-manager";

export type McpAuthedRequest = Request & {
  userId: string;
  sessionId: string;
  walletPublicKey: string;
};

export type McpAuthOk = {
  ok: true;
  userId: string;
  sessionId: string;
  walletPublicKey: string;
};

export type McpAuthFail = {
  ok: false;
  status: number;
  error: string;
};

export function extractMcpToken(req: Request): string {
  const header = req.headers.authorization ?? "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return String(req.headers["x-pay3-mcp-token"] ?? "").trim();
}

export async function resolveMcpToken(
  token: string
): Promise<McpAuthOk | McpAuthFail> {
  if (!token) {
    return { ok: false, status: 401, error: "MCP token required (Bearer)" };
  }

  const mcpTokenHash = hashMcpToken(token);
  const session = await prisma.aiSession.findFirst({
    where: { mcpTokenHash },
    include: { user: { include: { wallet: true } } },
  });

  if (!session?.user?.wallet) {
    return { ok: false, status: 401, error: "invalid MCP token" };
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

  if (!isSessionActive(session)) {
    return {
      ok: false,
      status: 403,
      error: "session inactive, expired, or revoked",
    };
  }

  return {
    ok: true,
    userId: session.userId,
    sessionId: session.id,
    walletPublicKey: session.user.wallet.publicKey,
  };
}

export async function requireMcpAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const auth = await resolveMcpToken(extractMcpToken(req));
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  (req as McpAuthedRequest).userId = auth.userId;
  (req as McpAuthedRequest).sessionId = auth.sessionId;
  (req as McpAuthedRequest).walletPublicKey = auth.walletPublicKey;
  next();
}
