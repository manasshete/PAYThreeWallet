import { Router } from "express";
import { prisma } from "@pay3/database";
import {
  isStellarPublicKey,
  resolveRecipient,
  type ContactRecord,
} from "@pay3/recipient-resolver";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const contactsRouter = Router();

contactsRouter.use(requireAuth);

function toRecord(c: {
  id: string;
  name: string;
  stellarAddress: string;
  verified: boolean;
}): ContactRecord {
  return {
    id: c.id,
    name: c.name,
    stellarAddress: c.stellarAddress,
    verified: c.verified,
  };
}

contactsRouter.get("/", async (req, res) => {
  const { userId } = req as AuthedRequest;
  const contacts = await prisma.contact.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
  res.json({ contacts: contacts.map(toRecord) });
});

/** Resolve a name or G-address — never guesses. Register before /:id. */
contactsRouter.post("/resolve", async (req, res) => {
  const { userId } = req as AuthedRequest;
  const recipient = String(req.body?.recipient ?? "").trim();

  const contacts = await prisma.contact.findMany({ where: { userId } });
  const result = resolveRecipient(
    recipient,
    contacts.map(toRecord)
  );

  if (!result.ok) {
    const status =
      result.reason === "ambiguous"
        ? 409
        : result.reason === "invalid_address"
          ? 400
          : 404;
    res.status(status).json(result);
    return;
  }

  res.json(result);
});

contactsRouter.post("/", async (req, res) => {
  const { userId } = req as AuthedRequest;
  const name = String(req.body?.name ?? "").trim();
  const stellarAddress = String(req.body?.stellarAddress ?? "").trim();
  const verified = Boolean(req.body?.verified ?? true);

  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  if (!isStellarPublicKey(stellarAddress)) {
    res.status(400).json({ error: "invalid Stellar address" });
    return;
  }

  const dup = await prisma.contact.findFirst({
    where: {
      userId,
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (dup) {
    res.status(409).json({
      error: `Contact "${name}" already exists (case-insensitive). Rename or edit the existing one.`,
    });
    return;
  }

  try {
    const contact = await prisma.contact.create({
      data: { userId, name, stellarAddress, verified },
    });
    res.status(201).json({ contact: toRecord(contact) });
  } catch (err) {
    console.error("contacts create failed:", err);
    res.status(500).json({ error: "failed to create contact" });
  }
});

contactsRouter.patch("/:id", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const id = String(req.params.id);

  const existing = await prisma.contact.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    res.status(404).json({ error: "contact not found" });
    return;
  }

  const name =
    req.body?.name !== undefined
      ? String(req.body.name).trim()
      : existing.name;
  const stellarAddress =
    req.body?.stellarAddress !== undefined
      ? String(req.body.stellarAddress).trim()
      : existing.stellarAddress;
  const verified =
    req.body?.verified !== undefined
      ? Boolean(req.body.verified)
      : existing.verified;

  if (!name) {
    res.status(400).json({ error: "name required" });
    return;
  }
  if (!isStellarPublicKey(stellarAddress)) {
    res.status(400).json({ error: "invalid Stellar address" });
    return;
  }

  const dup = await prisma.contact.findFirst({
    where: {
      userId,
      id: { not: id },
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (dup) {
    res.status(409).json({
      error: `Another contact is already named "${name}"`,
    });
    return;
  }

  const contact = await prisma.contact.update({
    where: { id },
    data: { name, stellarAddress, verified },
  });
  res.json({ contact: toRecord(contact) });
});

contactsRouter.delete("/:id", async (req, res) => {
  const { userId } = req as unknown as AuthedRequest;
  const id = String(req.params.id);

  const existing = await prisma.contact.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    res.status(404).json({ error: "contact not found" });
    return;
  }

  await prisma.contact.delete({ where: { id } });
  res.json({ ok: true });
});
