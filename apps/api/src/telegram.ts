import { randomBytes } from "node:crypto";
import { prisma } from "@pay3/database";
import {
  approvePendingTransfer,
  rejectPendingTransfer,
} from "./transfer-service.js";

// TELEGRAM_API_BASE is only overridden by local tests (fake Bot API server).
const API_BASE = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";
const LINK_CODE_TTL_MS = 15 * 60 * 1000;

type TgUpdate = {
  update_id: number;
  message?: { chat: { id: number }; text?: string };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number; text?: string };
  };
};

export function telegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME);
}

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(
    `${API_BASE}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    }
  );
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: unknown;
    description?: string;
  };
  if (!data.ok) throw new Error(`telegram ${method}: ${data.description ?? res.status}`);
  return data.result;
}

function shortAddr(a: string) {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-6)}` : a;
}

/** One-time deep link the dashboard shows; tapping it sends `/start <code>` to the bot. */
export async function createLinkCode(userId: string) {
  const linkCode = randomBytes(16).toString("base64url");
  const codeExpiresAt = new Date(Date.now() + LINK_CODE_TTL_MS);
  await prisma.telegramLink.upsert({
    where: { userId },
    create: { userId, linkCode, codeExpiresAt },
    update: { linkCode, codeExpiresAt },
  });
  return {
    url: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${linkCode}`,
    expiresAt: codeExpiresAt.toISOString(),
  };
}

/**
 * Push an approval prompt to the user's linked chat. Never throws — a Telegram
 * outage must not affect the transfer; the dashboard Approvals page still works.
 */
export async function notifyApprovalRequested(userId: string, approvalId: string) {
  if (!telegramConfigured()) return;
  try {
    const link = await prisma.telegramLink.findUnique({ where: { userId } });
    if (!link?.chatId) return;
    const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!approval?.transactionId) return;
    const tx = await prisma.transaction.findUnique({ where: { id: approval.transactionId } });
    if (!tx) return;

    const minutes = Math.max(1, Math.round((approval.expiresAt.getTime() - Date.now()) / 60_000));
    const what =
      tx.action === "execute_swap"
        ? `swap ${tx.amount} ${tx.asset ?? "XLM"} → ${tx.recipient}`
        : `send ${tx.amount} ${tx.asset ?? "XLM"}\nTo: ${shortAddr(tx.recipient ?? "?")}`;

    await tg("sendMessage", {
      chat_id: link.chatId,
      text: `🔔 Pay3 approval needed\n\nYour AI wants to ${what}\n\nExpires in ${minutes} min.`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ Approve", callback_data: `a:${approval.id}` },
            { text: "❌ Reject", callback_data: `r:${approval.id}` },
          ],
        ],
      },
    });
  } catch (err) {
    console.error("telegram notify failed:", err instanceof Error ? err.message : err);
  }
}

async function handleStart(chatId: string, code: string) {
  if (!code) {
    // Bot opened directly (not via the dashboard link) — nothing to link yet.
    await tg("sendMessage", {
      chat_id: chatId,
      text: "👋 I send Pay3 approval requests. To connect, open Pay3 → Settings → Telegram approvals and tap Connect Telegram.",
    });
    return;
  }
  const link = code
    ? await prisma.telegramLink.findUnique({ where: { linkCode: code } })
    : null;
  if (!link || !link.codeExpiresAt || link.codeExpiresAt < new Date()) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "This link has expired. Open Pay3 → Settings → Telegram approvals and tap Connect again.",
    });
    return;
  }
  // One chat ↔ one Pay3 account: detach this chat from any previous account.
  await prisma.telegramLink.updateMany({
    where: { chatId, NOT: { id: link.id } },
    data: { chatId: null, linkedAt: null },
  });
  await prisma.telegramLink.update({
    where: { id: link.id },
    data: { chatId, linkCode: null, codeExpiresAt: null, linkedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { userId: link.userId, action: "telegram_linked", metadata: {} },
  });
  await tg("sendMessage", {
    chat_id: chatId,
    text: "✅ Connected. You'll get a message here whenever your AI needs approval to spend.",
  });
}

async function handleDecision(
  q: NonNullable<TgUpdate["callback_query"]>
) {
  const [kind, approvalId] = (q.data ?? "").split(":");
  const chatId = q.message ? String(q.message.chat.id) : null;
  const link = chatId
    ? await prisma.telegramLink.findUnique({ where: { chatId } })
    : null;
  if (!link || !approvalId || (kind !== "a" && kind !== "r")) {
    await tg("answerCallbackQuery", {
      callback_query_id: q.id,
      text: "This chat isn't linked to a Pay3 account.",
      show_alert: true,
    });
    return;
  }

  // Answer right away — approving submits on-chain and can take a few seconds.
  await tg("answerCallbackQuery", {
    callback_query_id: q.id,
    text: kind === "a" ? "Approving…" : "Rejecting…",
  });

  let outcome: string;
  let decided = false;
  try {
    // Same checks as the dashboard: approval must belong to this user, be pending, not expired.
    if (kind === "a") {
      const result = await approvePendingTransfer(link.userId, approvalId);
      decided = true;
      const hash = result.transaction.stellarTransactionHash;
      outcome = `✅ Approved — sent.${hash ? `\nTx: ${hash}` : ""}`;
    } else {
      await rejectPendingTransfer(link.userId, approvalId);
      decided = true;
      outcome = "❌ Rejected. Nothing was sent.";
    }
  } catch (err) {
    // Submit-stage failures carry `transaction`: the approval itself went through.
    if (err && typeof err === "object" && "transaction" in err) decided = true;
    outcome = `⚠️ ${err instanceof Error ? err.message : "Failed"}`;
  }
  if (decided) {
    await prisma.auditLog.create({
      data: {
        userId: link.userId,
        action: "approval_decided_via_telegram",
        metadata: { approvalId, decision: kind === "a" ? "approved" : "rejected" },
      },
    });
  }

  if (q.message) {
    await tg("editMessageText", {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      text: `${q.message.text ?? ""}\n\n${outcome}`,
    });
  }
}

export async function handleTelegramUpdate(update: TgUpdate) {
  if (update.callback_query) {
    await handleDecision(update.callback_query);
    return;
  }
  const text = update.message?.text?.trim() ?? "";
  if (update.message && text.startsWith("/start")) {
    await handleStart(String(update.message.chat.id), text.slice("/start".length).trim());
  }
}

/** Local dev without a public URL: long-poll getUpdates instead of the webhook. */
export function startTelegramPolling() {
  if (!telegramConfigured()) {
    console.warn("TELEGRAM_POLLING set but TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_USERNAME missing");
    return;
  }
  let offset = 0;
  const loop = async () => {
    for (;;) {
      try {
        const updates = (await tg("getUpdates", { offset, timeout: 0 })) as TgUpdate[];
        for (const u of updates) {
          offset = u.update_id + 1;
          await handleTelegramUpdate(u).catch((err) =>
            console.error("telegram update failed:", err)
          );
        }
      } catch (err) {
        console.error("telegram polling:", err instanceof Error ? err.message : err);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  };
  void loop();
  console.log("telegram: polling for updates");
}
