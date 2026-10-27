import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { prisma } from "@pay3/database";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import {
  createLinkCode,
  handleTelegramUpdate,
  telegramConfigured,
} from "../telegram.js";

/** Dashboard: connect / disconnect the user's Telegram chat. */
export const telegramSettingsRouter = Router();

telegramSettingsRouter.use(requireAuth);

telegramSettingsRouter.get("/", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const link = await prisma.telegramLink.findUnique({ where: { userId } });
  res.json({
    configured: telegramConfigured(),
    linked: Boolean(link?.chatId),
    linkedAt: link?.linkedAt?.toISOString() ?? null,
  });
});

telegramSettingsRouter.post("/link", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  if (!telegramConfigured()) {
    res.status(503).json({ error: "Telegram bot not configured on this server" });
    return;
  }
  res.json(await createLinkCode(userId));
});

telegramSettingsRouter.delete("/", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  await prisma.telegramLink.deleteMany({ where: { userId } });
  res.json({ ok: true });
});

/** Bot API webhook. Telegram echoes the secret from setWebhook in this header. */
export const telegramWebhookRouter = Router();

telegramWebhookRouter.post("/webhook", async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  const got = String(req.header("x-telegram-bot-api-secret-token") ?? "");
  if (
    !telegramConfigured() ||
    !secret ||
    got.length !== secret.length ||
    !timingSafeEqual(Buffer.from(got), Buffer.from(secret))
  ) {
    res.status(404).end();
    return;
  }
  // Process before responding — serverless may freeze the function after res.end().
  try {
    await handleTelegramUpdate(req.body);
  } catch (err) {
    console.error("telegram webhook failed:", err);
  }
  // Always 200 so Telegram doesn't retry the same update forever.
  res.json({ ok: true });
});
