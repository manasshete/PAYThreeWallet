import { Router } from "express";
import { prisma } from "@pay3/database";
import { getAccountPayments } from "@pay3/stellar";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const historyRouter = Router();

historyRouter.use(requireAuth);

historyRouter.get("/", async (req, res) => {
  const { userId } = req as AuthedRequest;

  const account = await prisma.smartAccount.findUnique({
    where: { userId },
  });

  if (!account?.publicKey) {
    res.json({ payments: [], message: "Link a smart account first" });
    return;
  }

  try {
    const payments = await getAccountPayments(account.publicKey);
    res.json({
      publicKey: account.publicKey,
      payments,
    });
  } catch (err) {
    console.error("history failed:", err);
    res.status(500).json({ error: "failed to load history" });
  }
});
