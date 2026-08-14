import { createHash, randomBytes } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";

export const CLIENT_TYPES = ["claude", "cursor", "chatgpt", "other"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const DEFAULT_ALLOWED_ACTIONS = [
  "get_balance",
  "transfer",
  "get_transaction_history",
  "get_swap_quote",
] as const;

export const DEFAULT_BLOCKED = [
  "Unknown contracts",
  "Unapproved assets",
  "Actions outside policy",
] as const;

export type SessionPolicyRules = {
  durationHours: number;
  dailyBudget: string;
  asset: string;
  perTxMax: string;
  approvalAbove: string;
  allowedActions: string[];
  blockedNotes: string[];
};

export type SessionCreateInput = {
  clientType: string;
  label?: string;
  rules: SessionPolicyRules;
};

export function normalizeClientType(value: string): ClientType {
  const v = value.trim().toLowerCase();
  if ((CLIENT_TYPES as readonly string[]).includes(v)) {
    return v as ClientType;
  }
  return "other";
}

export function buildSessionAuthMessage(
  input: SessionCreateInput,
  nonce: string
): string {
  const { rules } = input;
  const client = normalizeClientType(input.clientType);
  const actions = rules.allowedActions.join(",");
  return [
    "Pay3 authorize AI session",
    `Client: ${client}`,
    `DurationHours: ${rules.durationHours}`,
    `DailyBudget: ${rules.dailyBudget} ${rules.asset}`,
    `PerTxMax: ${rules.perTxMax} ${rules.asset}`,
    `ApprovalAbove: ${rules.approvalAbove} ${rules.asset}`,
    `Actions: ${actions}`,
    `Nonce: ${nonce}`,
    "",
  ].join("\n");
}

export function createSessionKeypair(): {
  publicKey: string;
  secret: string;
} {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secret: kp.secret() };
}

/** MCP credential — plaintext returned once; store only the hash. */
export function createMcpToken(): { token: string; hash: string } {
  const token = `pay3_${randomBytes(24).toString("base64url")}`;
  return { token, hash: hashMcpToken(token) };
}

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function computeExpiresAt(
  from: Date,
  durationHours: number
): Date {
  return new Date(from.getTime() + durationHours * 60 * 60 * 1000);
}

export function isSessionActive(session: {
  status: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
}): boolean {
  if (session.revokedAt) return false;
  if (session.status !== "active") return false;
  if (session.expiresAt && session.expiresAt <= new Date()) return false;
  return true;
}

export function permissionSummary(input: SessionCreateInput): {
  allowed: string[];
  blocked: string[];
} {
  const actionLabels: Record<string, string> = {
    get_balance: "Check balances",
    transfer: "Send payments",
    get_transaction_history: "View transaction history",
    get_swap_quote: "Get DeFi swap quotes",
    execute_swap: "Execute DeFi swaps (Soroswap)",
    x402_fetch: "Pay for x402 API calls (micropayments)",
    blend_supply: "Supply to Blend (coming soon)",
  };
  const allowed = input.rules.allowedActions.map(
    (a) => actionLabels[a] ?? a
  );
  const blocked = [
    ...input.rules.blockedNotes,
    ...DEFAULT_BLOCKED.filter(
      (b) => !input.rules.blockedNotes.includes(b)
    ),
  ];
  return { allowed, blocked: [...new Set(blocked)] };
}

export function defaultSessionRules(): SessionPolicyRules {
  return {
    durationHours: 24,
    dailyBudget: "100",
    asset: "XLM",
    perTxMax: "20",
    approvalAbove: "15",
    allowedActions: [...DEFAULT_ALLOWED_ACTIONS],
    blockedNotes: [...DEFAULT_BLOCKED],
  };
}

/** Self-check for session auth message + token hashing. */
export function sessionManagerSelfCheck(): void {
  const rules = defaultSessionRules();
  const msg = buildSessionAuthMessage(
    { clientType: "claude", rules },
    "abc123"
  );
  if (!msg.includes("Client: claude") || !msg.includes("Nonce: abc123")) {
    throw new Error("self-check: auth message failed");
  }
  const { token, hash } = createMcpToken();
  if (hashMcpToken(token) !== hash) {
    throw new Error("self-check: mcp token hash failed");
  }
  if (isSessionActive({ status: "active", expiresAt: null, revokedAt: new Date() })) {
    throw new Error("self-check: revoked should be inactive");
  }
}
