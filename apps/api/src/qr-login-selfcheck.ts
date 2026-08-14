/**
 * QR login status-transition self-check (memory or DB).
 * Usage: node --import tsx apps/api/src/qr-login-selfcheck.ts
 * Or: npm run smoke:qr -w @pay3/api (if wired)
 */
import { Keypair } from "@stellar/stellar-sdk";
import { buildAuthMessage, QR_LOGIN_TTL_MS } from "@pay3/shared";
import {
  approveQrLogin,
  claimQrLogin,
  createChallenge,
  createQrLogin,
  findOrCreateUser,
  findQrLogin,
  markChallengeUsed,
} from "./auth-store.js";
import { hashSep53Message, verifySep53Signature } from "./sep53.js";
import { randomBytes } from "node:crypto";

async function main() {
  const kp = Keypair.random();
  const session = await createQrLogin(new Date(Date.now() + QR_LOGIN_TTL_MS));
  if (session.status !== "pending") throw new Error("expected pending");

  const nonce = randomBytes(16).toString("hex");
  const challenge = await createChallenge(
    kp.publicKey(),
    nonce,
    new Date(Date.now() + 60_000)
  );
  const message = buildAuthMessage(nonce);
  const sig = kp.sign(hashSep53Message(message)).toString("base64");
  if (!verifySep53Signature(kp.publicKey(), message, sig)) {
    throw new Error("sep53 failed");
  }
  await markChallengeUsed(challenge.id, nonce);

  const user = await findOrCreateUser(kp.publicKey());
  const claimToken = randomBytes(16).toString("hex");
  const approved = await approveQrLogin(
    session.id,
    kp.publicKey(),
    user.id,
    claimToken
  );
  if (approved?.status !== "approved") throw new Error("expected approved");

  const claimed = await claimQrLogin(session.id, claimToken);
  if (claimed?.status !== "claimed") throw new Error("expected claimed");

  const again = await claimQrLogin(session.id, claimToken);
  if (again) throw new Error("second claim must fail");

  const final = await findQrLogin(session.id);
  if (final?.status !== "claimed") throw new Error("final status claimed");

  console.log("qr-login self-check OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
