import type { NextFunction, Request, Response } from "express";
import { AUTH_USER_COOKIE } from "@pay3/shared";
import { findUserById } from "../auth-store.js";

export type AuthedRequest = Request & {
  userId: string;
  walletPublicKey: string;
};

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.cookies?.[AUTH_USER_COOKIE];
  if (!userId) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }

  const user = await findUserById(userId);
  if (!user) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }

  (req as AuthedRequest).userId = user.id;
  (req as AuthedRequest).walletPublicKey = user.publicKey;
  next();
}
