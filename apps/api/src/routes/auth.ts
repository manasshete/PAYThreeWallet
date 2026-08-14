import { randomBytes } from "node:crypto";
import { Router } from "express";
import { Keypair } from "@stellar/stellar-sdk";
import {
  AUTH_COOKIE,
  AUTH_USER_COOKIE,
  buildAuthMessage,
  CHALLENGE_TTL_MS,
  SESSION_TTL_MS,
  type AuthChallengeResponse,
} from "@pay3/shared";
import {
  authBackend,
  createChallenge,
  databaseProvider,
  findChallengeByNonce,
  findOrCreateUser,
  findUserProfileById,
  markChallengeUsed,
} from "../auth-store.js";
import { verifySep53Signature } from "../sep53.js";

export const authRouter = Router();

authRouter.post("/challenge", async (req, res) => {
  const publicKey = String(req.body?.publicKey ?? "").trim();
  if (!publicKey) {
    res.status(400).json({ error: "publicKey required" });
    return;
  }

  try {
    Keypair.fromPublicKey(publicKey);
  } catch {
    res.status(400).json({ error: "invalid Stellar public key" });
    return;
  }

  try {
    const nonce = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    await createChallenge(publicKey, nonce, expiresAt);

    const payload: AuthChallengeResponse = {
      nonce,
      message: buildAuthMessage(nonce),
      expiresAt: expiresAt.toISOString(),
    };

    res.json(payload);
  } catch (err) {
    console.error("auth/challenge failed:", err);
    const detail =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? ` (${err.message})`
        : "";
    res.status(500).json({
      error:
        "auth storage unavailable — set DATABASE_URL in apps/api/.env (real Neon URL, not the example placeholder), run prisma db push, and restart the API" +
        detail,
    });
  }
});

authRouter.post("/verify", async (req, res) => {
  const publicKey = String(req.body?.publicKey ?? "").trim();
  const signature = String(req.body?.signature ?? "").trim();
  const nonce = String(req.body?.nonce ?? "").trim();

  if (!publicKey || !signature || !nonce) {
    res.status(400).json({ error: "publicKey, signature, and nonce required" });
    return;
  }

  try {
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
    const valid = verifySep53Signature(publicKey, message, signature);
    if (!valid) {
      res.status(401).json({ error: "signature verification failed" });
      return;
    }

    await markChallengeUsed(challenge.id, nonce);
    const user = await findOrCreateUser(publicKey);

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

    res.json({ user });
  } catch (err) {
    console.error("auth/verify failed:", err);
    res.status(500).json({ error: "verification failed" });
  }
});

authRouter.get("/me", async (req, res) => {
  const userId = req.cookies?.[AUTH_USER_COOKIE];
  if (!userId) {
    res.json({ user: null });
    return;
  }

  try {
    const profile = await findUserProfileById(userId);
    res.json({ user: profile });
  } catch (err) {
    console.error("auth/me failed:", err);
    res.json({ user: null });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
  res.clearCookie(AUTH_USER_COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/status", (_req, res) => {
  res.json({
    backend: authBackend(),
    databaseConfigured: authBackend() === "database",
    provider: databaseProvider(),
  });
});
