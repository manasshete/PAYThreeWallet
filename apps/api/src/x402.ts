/**
 * x402 challenge parsing + payment proof header (Stellar MVP).
 */
export type X402Accept = {
  amount: string;
  asset: string;
  payTo: string;
  resource?: string;
  memo?: string;
};

export type X402Challenge = {
  version: number;
  accepts: X402Accept[];
};

export function parseX402Challenge(body: unknown): X402Challenge | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const version = Number(o.x402Version ?? o.version ?? 1);
  const raw = o.accepts ?? o.paymentRequirements;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const accepts: X402Accept[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const amount = String(a.amount ?? a.maxAmountRequired ?? "").trim();
    const asset = String(a.asset ?? "XLM").trim().toUpperCase();
    const payTo = String(a.payTo ?? a.recipient ?? a.destination ?? "").trim();
    if (!amount || !payTo.startsWith("G")) continue;
    accepts.push({
      amount,
      asset,
      payTo,
      resource: a.resource ? String(a.resource) : undefined,
      memo: a.memo ? String(a.memo) : undefined,
    });
  }
  if (!accepts.length) return null;
  return { version, accepts };
}

/** Proof sent on retry after payment (Pay3 demo + compatible APIs). */
export function buildX402PaymentHeader(txHash: string): string {
  return `stellar-tx=${txHash.trim()}`;
}

export function parseX402PaymentHeader(header: string | null | undefined): string | null {
  if (!header?.trim()) return null;
  const m = header.match(/stellar-tx=([a-f0-9]{64})/i);
  return m?.[1] ?? null;
}
