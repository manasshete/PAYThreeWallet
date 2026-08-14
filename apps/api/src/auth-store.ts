import { randomBytes } from "node:crypto";
import { prisma } from "@pay3/database";
import type { QrLoginStatus, UserProfile } from "@pay3/shared";

export type StoredChallenge = {
  id: string;
  publicKey: string;
  nonce: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type StoredUser = {
  id: string;
  publicKey: string;
};

export type StoredQrLogin = {
  id: string;
  status: QrLoginStatus;
  publicKey: string | null;
  userId: string | null;
  claimToken: string | null;
  expiresAt: Date;
  claimedAt: Date | null;
};

// ponytail: in-memory auth when DATABASE_URL unset; single-process dev only
const memoryChallenges = new Map<string, StoredChallenge>();
const memoryUsersByKey = new Map<string, StoredUser>();
const memoryQrLogins = new Map<string, StoredQrLogin>();

function isConfiguredDatabaseUrl(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || url.startsWith("file:")) return false;
  if (url.includes("USER:PASSWORD") || url.includes("ep-xxxx")) return false;
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

function useDatabase(): boolean {
  return isConfiguredDatabaseUrl();
}

export function authBackend(): "database" | "memory" {
  return useDatabase() ? "database" : "memory";
}

export function databaseProvider(): string | null {
  if (!useDatabase()) return null;
  const url = process.env.DATABASE_URL ?? "";
  if (url.includes("neon.tech")) return "Neon";
  return "PostgreSQL";
}

export async function createChallenge(
  publicKey: string,
  nonce: string,
  expiresAt: Date
): Promise<StoredChallenge> {
  if (useDatabase()) {
    const row = await prisma.authChallenge.create({
      data: { publicKey, nonce, expiresAt },
    });
    return {
      id: row.id,
      publicKey: row.publicKey,
      nonce: row.nonce,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
    };
  }

  const challenge: StoredChallenge = {
    id: randomBytes(8).toString("hex"),
    publicKey,
    nonce,
    expiresAt,
    usedAt: null,
  };
  memoryChallenges.set(nonce, challenge);
  return challenge;
}

export async function findChallengeByNonce(
  nonce: string
): Promise<StoredChallenge | null> {
  if (useDatabase()) {
    const row = await prisma.authChallenge.findUnique({ where: { nonce } });
    if (!row) return null;
    return {
      id: row.id,
      publicKey: row.publicKey,
      nonce: row.nonce,
      expiresAt: row.expiresAt,
      usedAt: row.usedAt,
    };
  }

  return memoryChallenges.get(nonce) ?? null;
}

export async function markChallengeUsed(id: string, nonce: string): Promise<void> {
  if (useDatabase()) {
    await prisma.authChallenge.update({
      where: { id },
      data: { usedAt: new Date() },
    });
    return;
  }

  const challenge = memoryChallenges.get(nonce);
  if (challenge) {
    challenge.usedAt = new Date();
    memoryChallenges.set(nonce, challenge);
  }
}

export async function findOrCreateUser(publicKey: string): Promise<StoredUser> {
  if (useDatabase()) {
    const existing = await prisma.user.findFirst({
      where: { wallet: { publicKey } },
      include: { wallet: true },
    });
    if (existing?.wallet) {
      return { id: existing.id, publicKey: existing.wallet.publicKey };
    }

    const created = await prisma.user.create({
      data: {
        wallet: { create: { publicKey } },
        smartAccount: { create: { status: "pending" } },
      },
      include: { wallet: true },
    });
    return { id: created.id, publicKey: created.wallet!.publicKey };
  }

  const existing = memoryUsersByKey.get(publicKey);
  if (existing) return existing;

  const user: StoredUser = {
    id: randomBytes(12).toString("hex"),
    publicKey,
  };
  memoryUsersByKey.set(publicKey, user);
  return user;
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  if (useDatabase()) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!user?.wallet) return null;
    return { id: user.id, publicKey: user.wallet.publicKey };
  }

  for (const user of memoryUsersByKey.values()) {
    if (user.id === id) return user;
  }
  return null;
}

export async function findUserProfileById(
  id: string
): Promise<UserProfile | null> {
  const storage = authBackend();

  if (useDatabase()) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        wallet: true,
        smartAccount: true,
        aiSessions: {
          where: {
            status: "active",
            revokedAt: null,
          },
        },
      },
    });

    if (!user?.wallet) return null;

    const now = new Date();
    const activeSessions = user.aiSessions.filter(
      (s) => !s.expiresAt || s.expiresAt > now
    ).length;

    return {
      id: user.id,
      publicKey: user.wallet.publicKey,
      smartAccount: user.smartAccount
        ? {
            status: user.smartAccount.status,
            contractRef: user.smartAccount.contractRef,
            publicKey: user.smartAccount.publicKey ?? null,
          }
        : null,
      activeSessions,
      storage,
      storageProvider: databaseProvider() ?? undefined,
    };
  }

  const memoryUser = [...memoryUsersByKey.values()].find((u) => u.id === id);
  if (!memoryUser) return null;

  return {
    id: memoryUser.id,
    publicKey: memoryUser.publicKey,
    smartAccount: null,
    activeSessions: 0,
    storage,
  };
}

function mapQrRow(row: {
  id: string;
  status: string;
  publicKey: string | null;
  userId: string | null;
  claimToken: string | null;
  expiresAt: Date;
  claimedAt: Date | null;
}): StoredQrLogin {
  return {
    id: row.id,
    status: row.status as QrLoginStatus,
    publicKey: row.publicKey,
    userId: row.userId,
    claimToken: row.claimToken,
    expiresAt: row.expiresAt,
    claimedAt: row.claimedAt,
  };
}

export async function createQrLogin(expiresAt: Date): Promise<StoredQrLogin> {
  if (useDatabase()) {
    const row = await prisma.qrLoginSession.create({
      data: { expiresAt, status: "pending" },
    });
    return mapQrRow(row);
  }

  const session: StoredQrLogin = {
    id: randomBytes(16).toString("hex"),
    status: "pending",
    publicKey: null,
    userId: null,
    claimToken: null,
    expiresAt,
    claimedAt: null,
  };
  memoryQrLogins.set(session.id, session);
  return session;
}

export async function findQrLogin(id: string): Promise<StoredQrLogin | null> {
  if (useDatabase()) {
    const row = await prisma.qrLoginSession.findUnique({ where: { id } });
    return row ? mapQrRow(row) : null;
  }
  return memoryQrLogins.get(id) ?? null;
}

export async function approveQrLogin(
  id: string,
  publicKey: string,
  userId: string,
  claimToken: string
): Promise<StoredQrLogin | null> {
  if (useDatabase()) {
    const row = await prisma.qrLoginSession.update({
      where: { id },
      data: {
        status: "approved",
        publicKey,
        userId,
        claimToken,
      },
    });
    return mapQrRow(row);
  }

  const session = memoryQrLogins.get(id);
  if (!session) return null;
  session.status = "approved";
  session.publicKey = publicKey;
  session.userId = userId;
  session.claimToken = claimToken;
  memoryQrLogins.set(id, session);
  return session;
}

export async function claimQrLogin(
  id: string,
  claimToken: string
): Promise<StoredQrLogin | null> {
  const session = await findQrLogin(id);
  if (
    !session ||
    session.status !== "approved" ||
    !session.claimToken ||
    session.claimToken !== claimToken ||
    session.expiresAt < new Date()
  ) {
    return null;
  }

  if (useDatabase()) {
    const row = await prisma.qrLoginSession.update({
      where: { id },
      data: { status: "claimed", claimedAt: new Date(), claimToken: null },
    });
    return mapQrRow({ ...row, claimToken: session.claimToken });
  }

  session.status = "claimed";
  session.claimedAt = new Date();
  const token = session.claimToken;
  session.claimToken = null;
  memoryQrLogins.set(id, session);
  return { ...session, claimToken: token };
}
