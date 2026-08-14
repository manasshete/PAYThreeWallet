import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";

const SEP53_PREFIX = "Stellar Signed Message:\n";

export function hashSep53Message(message: string): Buffer {
  const payload = Buffer.concat([
    Buffer.from(SEP53_PREFIX, "utf8"),
    Buffer.from(message, "utf8"),
  ]);
  return createHash("sha256").update(payload).digest();
}

function parseSignature(signature: string): Buffer {
  const fromBase64 = Buffer.from(signature, "base64");
  if (fromBase64.length === 64) return fromBase64;

  const fromHex = Buffer.from(signature, "hex");
  if (fromHex.length === 64) return fromHex;

  throw new Error("invalid signature encoding");
}

export function verifySep53Signature(
  publicKey: string,
  message: string,
  signature: string
): boolean {
  try {
    const keypair = Keypair.fromPublicKey(publicKey);
    const messageHash = hashSep53Message(message);
    const sig = parseSignature(signature);
    return keypair.verify(messageHash, sig);
  } catch {
    return false;
  }
}

/** Dev self-check: SEP-53 sign/verify roundtrip */
export function sep53SelfCheck(): boolean {
  const kp = Keypair.random();
  const message = "Pay3 sign-in\nNonce: test\n";
  const hash = hashSep53Message(message);
  const sig = kp.sign(hash).toString("base64");
  return verifySep53Signature(kp.publicKey(), message, sig);
}

// CLI self-check only when run directly under tsx/node ESM
try {
  if (
    typeof import.meta.url === "string" &&
    import.meta.url.length > 0 &&
    import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`
  ) {
    console.assert(sep53SelfCheck(), "SEP-53 self-check failed");
  }
} catch {
  /* cjs bundle */
}
