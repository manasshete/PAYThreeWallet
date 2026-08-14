export const AUTH_COOKIE = "pay3_session";
export const AUTH_USER_COOKIE = "pay3_uid";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Desktop QR login room TTL */
export const QR_LOGIN_TTL_MS = 3 * 60 * 1000;

export type QrLoginStatus = "pending" | "approved" | "claimed" | "expired";
export const APPROVAL_TTL_MS = 2 * 60 * 1000;
export const MAX_TECHNICAL_RETRIES = 2;

export type AuthChallengeResponse = {
  nonce: string;
  message: string;
  expiresAt: string;
};

export type AuthVerifyRequest = {
  publicKey: string;
  signature: string;
  nonce: string;
};

export type AuthUser = {
  id: string;
  publicKey: string;
};

export type UserProfile = AuthUser & {
  smartAccount: {
    status: string;
    contractRef: string | null;
    publicKey: string | null;
    custodyMode?: "legacy" | "contract";
    contractVersion?: string | null;
  } | null;
  activeSessions: number;
  storage: "database" | "memory";
  storageProvider?: string;
};

export type SmartAccountView = {
  status: string;
  publicKey: string | null;
  contractRef?: string | null;
  custodyMode?: "legacy" | "contract";
  contractVersion?: string | null;
  balances?: { asset: string; balance: string }[];
  xlmBalance?: string;
  /** Legacy G-account balance when migrating (read-only). */
  legacyXlmBalance?: string;
  network?: string;
  model?: string;
};

export type HorizonPaymentView = {
  id: string;
  type: string;
  createdAt: string;
  amount: string | null;
  asset: string | null;
  from: string | null;
  to: string | null;
  transactionHash: string | null;
};

export type ContactView = {
  id: string;
  name: string;
  stellarAddress: string;
  verified: boolean;
};

export type SessionPolicyRules = {
  durationHours: number;
  dailyBudget: string;
  asset: string;
  perTxMax: string;
  approvalAbove: string;
  allowedActions: string[];
  blockedNotes: string[];
};

export type SessionView = {
  id: string;
  clientType: string;
  label: string | null;
  sessionPublicKey: string | null;
  status: string;
  expiresAt: string | null;
  expiresLedger?: number | null;
  revokedAt: string | null;
  createdAt: string;
  policy: { name: string; rules: unknown } | null;
  active: boolean;
  onchainRegisterTxHash?: string | null;
  onchainRevokeTxHash?: string | null;
  /** Present when Freighter must sign add_session / revoke_session */
  needsOnchainAuth?: boolean;
};

export type TransactionView = {
  id: string;
  sessionId: string | null;
  action: string;
  asset: string | null;
  amount: string | null;
  recipient: string | null;
  policyDecision: string | null;
  status: string;
  stellarTransactionHash: string | null;
  retryCount: number;
  idempotencyKey: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type ApprovalView = {
  id: string;
  transactionId: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  transaction?: TransactionView | null;
};

export type AuditLogView = {
  id: string;
  action: string;
  metadata: unknown;
  createdAt: string;
};

export type UsageView = {
  month: string;
  txCount: number;
  volume: string;
  asset: string;
};

export type ApiHealth = {
  ok: boolean;
  service: "pay3-api";
  timestamp: string;
};

export const DASHBOARD_NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/contacts", label: "Contacts" },
  { href: "/dashboard/sessions", label: "Sessions" },
  { href: "/dashboard/policies", label: "Policies" },
  { href: "/dashboard/history", label: "History" },
  { href: "/dashboard/approvals", label: "Approvals" },
  { href: "/dashboard/audit", label: "Audit" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/guide", label: "Guide" },
] as const;

export function buildAuthMessage(nonce: string): string {
  return `Pay3 sign-in\nNonce: ${nonce}\n`;
}
