import { randomBytes } from "node:crypto";
import { Router } from "express";
import { Keypair } from "@stellar/stellar-sdk";
import {
  AUTH_COOKIE,
  AUTH_USER_COOKIE,
  buildAuthMessage,
  CHALLENGE_TTL_MS,
  QR_LOGIN_TTL_MS,
  SESSION_TTL_MS,
  type QrLoginStatus,
} from "@pay3/shared";
import {
  approveQrLogin,
  claimQrLogin,
  createChallenge,
  createQrLogin,
  findChallengeByNonce,
  findOrCreateUser,
  findQrLogin,
  findUserById,
  markChallengeUsed,
} from "../auth-store.js";
import { verifySep53Signature } from "../sep53.js";

export const authQrRouter = Router();

// ponytail: beta IP throttle; upgrade to Redis if abuse appears
const startHits = new Map<string, { n: number; reset: number }>();
const START_LIMIT = 20;
const START_WINDOW_MS = 60_000;

function rateLimitStart(ip: string): boolean {
  const now = Date.now();
  const row = startHits.get(ip);
  if (!row || row.reset < now) {
    startHits.set(ip, { n: 1, reset: now + START_WINDOW_MS });
    return true;
  }
  if (row.n >= START_LIMIT) return false;
  row.n += 1;
  return true;
}

function webOrigin(): string {
  // Prefer explicit public origin so phone QR works off LAN (any network)
  const raw =
    process.env.PUBLIC_WEB_ORIGIN ??
    process.env.WEB_ORIGIN ??
    "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

function effectiveStatus(session: {
  status: QrLoginStatus;
  expiresAt: Date;
}): QrLoginStatus {
  if (
    (session.status === "pending" || session.status === "approved") &&
    session.expiresAt < new Date()
  ) {
    return "expired";
  }
  return session.status;
}

authQrRouter.post("/qr/start", async (req, res) => {
  const ip = String(req.ip ?? req.socket.remoteAddress ?? "unknown");
  if (!rateLimitStart(ip)) {
    res.status(429).json({ error: "too many QR login starts" });
    return;
  }

  try {
    const expiresAt = new Date(Date.now() + QR_LOGIN_TTL_MS);
    const session = await createQrLogin(expiresAt);
    res.json({
      id: session.id,
      expiresAt: session.expiresAt.toISOString(),
      url: `${webOrigin()}/login/qr/${session.id}`,
    });
  } catch (err) {
    console.error("auth/qr/start failed:", err);
    res.status(500).json({ error: "could not create QR login session" });
  }
});

authQrRouter.get("/qr/:id/status", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "id required" });
    return;
  }

  try {
    const session = await findQrLogin(id);
    if (!session) {
      res.status(404).json({ error: "not found" });
      return;
    }

    const status = effectiveStatus(session);
    const body: {
      status: QrLoginStatus;
      expiresAt: string;
      claimToken?: string;
      publicKey?: string;
    } = {
      status,
      expiresAt: session.expiresAt.toISOString(),
    };

    if (status === "approved" && session.claimToken) {
      body.claimToken = session.claimToken;
      if (session.publicKey) body.publicKey = session.publicKey;
    }

    res.json(body);
  } catch (err) {
    console.error("auth/qr/status failed:", err);
    res.status(500).json({ error: "status failed" });
  }
});

authQrRouter.post("/qr/:id/complete", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const publicKey = String(req.body?.publicKey ?? "").trim();
  const signature = String(req.body?.signature ?? "").trim();
  const nonce = String(req.body?.nonce ?? "").trim();

  if (!id || !publicKey || !signature || !nonce) {
    res.status(400).json({
      error: "id, publicKey, signature, and nonce required",
    });
    return;
  }

  try {
    Keypair.fromPublicKey(publicKey);
  } catch {
    res.status(400).json({ error: "invalid Stellar public key" });
    return;
  }

  try {
    const session = await findQrLogin(id);
    if (!session) {
      res.status(404).json({ error: "not found" });
      return;
    }
    if (effectiveStatus(session) !== "pending") {
      res.status(409).json({ error: "session not pending" });
      return;
    }

    const challenge = await findChallengeByNonce(nonce);
    if (
      !challenge ||
      challenge.publicKey !== publicKey ||
      challenge.usedAt ||
      challenge.expiresAt < new Date()
    ) {
      res.status(401).json({ error: "invalid or expired challenge" });
      return;
    }

    const message = buildAuthMessage(nonce);
    if (!verifySep53Signature(publicKey, message, signature)) {
      res.status(401).json({ error: "signature verification failed" });
      return;
    }

    await markChallengeUsed(challenge.id, nonce);
    const user = await findOrCreateUser(publicKey);
    const claimToken = randomBytes(32).toString("hex");
    await approveQrLogin(id, publicKey, user.id, claimToken);

    res.json({ ok: true, publicKey: user.publicKey });
  } catch (err) {
    console.error("auth/qr/complete failed:", err);
    res.status(500).json({ error: "complete failed" });
  }
});

authQrRouter.post("/qr/:id/claim", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const claimToken = String(req.body?.claimToken ?? "").trim();

  if (!id || !claimToken) {
    res.status(400).json({ error: "id and claimToken required" });
    return;
  }

  try {
    const claimed = await claimQrLogin(id, claimToken);
    if (!claimed?.userId || !claimed.publicKey) {
      res.status(401).json({ error: "invalid or expired claim" });
      return;
    }

    const user = await findUserById(claimed.userId);
    if (!user) {
      res.status(401).json({ error: "user not found" });
      return;
    }

    const sessionToken = randomBytes(32).toString("hex");
    const maxAge = SESSION_TTL_MS;

    res.cookie(AUTH_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
    });
    res.cookie(AUTH_USER_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge,
    });

    res.json({ user: { id: user.id, publicKey: user.publicKey } });
  } catch (err) {
    console.error("auth/qr/claim failed:", err);
    res.status(500).json({ error: "claim failed" });
  }
});

/** Used by mobile page before signing — same as /challenge but documents QR flow */
authQrRouter.post("/qr/:id/challenge", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  const publicKey = String(req.body?.publicKey ?? "").trim();

  if (!id || !publicKey) {
    res.status(400).json({ error: "id and publicKey required" });
    return;
  }

  try {
    Keypair.fromPublicKey(publicKey);
  } catch {
    res.status(400).json({ error: "invalid Stellar public key" });
    return;
  }

  try {
    const session = await findQrLogin(id);
    if (!session || effectiveStatus(session) !== "pending") {
      res.status(409).json({ error: "session not pending" });
      return;
    }

    const nonce = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
    await createChallenge(publicKey, nonce, expiresAt);

    res.json({
      nonce,
      message: buildAuthMessage(nonce),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("auth/qr/challenge failed:", err);
    res.status(500).json({ error: "challenge failed" });
  }
});
