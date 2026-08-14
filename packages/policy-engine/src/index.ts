import {
  defaultSessionRules,
  type SessionPolicyRules,
} from "@pay3/session-manager";

export type PolicyDecision =
  | "AUTO_EXECUTE"
  | "PENDING_APPROVAL"
  | "REJECTED";

export type PolicyRequest = {
  action: string;
  asset?: string;
  amount?: string;
  recipient?: string;
};

export type PolicyContext = {
  rules: SessionPolicyRules;
  sessionActive: boolean;
  /** Amount already spent today in the same asset (decimal string). */
  spentToday?: string;
};

export type PolicyResult = {
  decision: PolicyDecision;
  reason: string;
  checks: string[];
};

function parseAmount(value: string | undefined): number | null {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Off-chain three-level policy evaluation (§22).
 * On-chain Soroban enforcement comes later — this is the flexible layer.
 */
export function evaluatePolicy(
  request: PolicyRequest,
  ctx: PolicyContext
): PolicyResult {
  const checks: string[] = [];

  if (!ctx.sessionActive) {
    return {
      decision: "REJECTED",
      reason: "Session is not active (expired or revoked)",
      checks: ["session_active: fail"],
    };
  }
  checks.push("session_active: ok");

  const action = request.action.trim().toLowerCase();
  const allowed = ctx.rules.allowedActions.map((a) => a.toLowerCase());
  if (!allowed.includes(action)) {
    return {
      decision: "REJECTED",
      reason: `Action "${request.action}" is not allowed for this session`,
      checks: [...checks, `action_allowed: fail (${request.action})`],
    };
  }
  checks.push(`action_allowed: ok (${action})`);

  // Read-only tools auto-execute
  if (
    action === "get_balance" ||
    action === "get_transaction_history" ||
    action === "get_swap_quote"
  ) {
    return {
      decision: "AUTO_EXECUTE",
      reason: "Read-only action within session permissions",
      checks: [...checks, "read_only: auto"],
    };
  }

  if (action !== "transfer" && action !== "execute_swap" && action !== "x402_fetch") {
    return {
      decision: "REJECTED",
      reason: `Unknown financial action "${request.action}"`,
      checks: [...checks, "action_known: fail"],
    };
  }

  // --- transfer / execute_swap / x402_fetch amount checks ---
  const asset = (request.asset ?? "").trim().toUpperCase();
  const ruleAsset = ctx.rules.asset.trim().toUpperCase();
  if (!asset) {
    return {
      decision: "REJECTED",
      reason: `Asset is required for ${action}`,
      checks: [...checks, "asset: missing"],
    };
  }
  if (asset !== ruleAsset) {
    return {
      decision: "REJECTED",
      reason: `Asset ${asset} not allowed (session allows ${ruleAsset})`,
      checks: [...checks, `asset: fail (${asset} vs ${ruleAsset})`],
    };
  }
  checks.push(`asset: ok (${asset})`);

  if (action === "transfer" || action === "x402_fetch") {
    if (!request.recipient?.trim()) {
      return {
        decision: "REJECTED",
        reason:
          action === "x402_fetch"
            ? "payTo recipient is required for x402_fetch"
            : "Recipient is required for transfer",
        checks: [...checks, "recipient: missing"],
      };
    }
    checks.push("recipient: present");
  } else {
    // execute_swap: output asset required (stored in recipient field by service)
    if (!request.recipient?.trim()) {
      return {
        decision: "REJECTED",
        reason: "asset_out is required for execute_swap",
        checks: [...checks, "asset_out: missing"],
      };
    }
    checks.push(`asset_out: ${request.recipient.trim().toUpperCase()}`);
  }

  const amount = parseAmount(request.amount);
  if (amount === null || amount <= 0) {
    return {
      decision: "REJECTED",
      reason: "Amount must be a positive number",
      checks: [...checks, "amount: invalid"],
    };
  }
  checks.push(`amount: ${amount}`);

  const perTxMax = parseAmount(ctx.rules.perTxMax);
  if (perTxMax === null) {
    return {
      decision: "REJECTED",
      reason: "Session per-transaction limit is misconfigured",
      checks: [...checks, "per_tx_max: invalid_config"],
    };
  }
  if (amount > perTxMax) {
    return {
      decision: "REJECTED",
      reason: `Amount ${amount} exceeds per-transaction max ${perTxMax} ${ruleAsset}`,
      checks: [...checks, `per_tx_max: fail (${amount} > ${perTxMax})`],
    };
  }
  checks.push(`per_tx_max: ok (<= ${perTxMax})`);

  const dailyBudget = parseAmount(ctx.rules.dailyBudget);
  const spentToday = parseAmount(ctx.spentToday ?? "0") ?? 0;
  if (dailyBudget === null) {
    return {
      decision: "REJECTED",
      reason: "Session daily budget is misconfigured",
      checks: [...checks, "daily_budget: invalid_config"],
    };
  }
  if (spentToday + amount > dailyBudget) {
    return {
      decision: "REJECTED",
      reason: `Amount would exceed daily budget (${spentToday} + ${amount} > ${dailyBudget} ${ruleAsset})`,
      checks: [
        ...checks,
        `daily_budget: fail (spent ${spentToday} + ${amount} > ${dailyBudget})`,
      ],
    };
  }
  checks.push(`daily_budget: ok (spent ${spentToday} + ${amount} <= ${dailyBudget})`);

  const approvalAbove = parseAmount(ctx.rules.approvalAbove);
  if (approvalAbove === null) {
    return {
      decision: "REJECTED",
      reason: "Session approval threshold is misconfigured",
      checks: [...checks, "approval_above: invalid_config"],
    };
  }

  if (amount > approvalAbove) {
    return {
      decision: "PENDING_APPROVAL",
      reason: `Amount ${amount} is above approval threshold ${approvalAbove} ${ruleAsset}`,
      checks: [
        ...checks,
        `approval_threshold: pending (${amount} > ${approvalAbove})`,
      ],
    };
  }

  checks.push(`approval_threshold: ok (<= ${approvalAbove})`);
  return {
    decision: "AUTO_EXECUTE",
    reason:
      action === "execute_swap"
        ? "Swap within autonomous limits"
        : action === "x402_fetch"
          ? "x402 API payment within autonomous limits"
          : "Transfer within autonomous limits",
    checks,
  };
}

export type PolicyPreset = "conservative" | "balanced" | "custom";

export function policyPreset(name: PolicyPreset): SessionPolicyRules {
  const base = defaultSessionRules();
  if (name === "conservative") {
    return {
      ...base,
      durationHours: 12,
      dailyBudget: "50",
      perTxMax: "10",
      approvalAbove: "5",
    };
  }
  if (name === "balanced") {
    return {
      ...base,
      durationHours: 24,
      dailyBudget: "100",
      perTxMax: "20",
      approvalAbove: "15",
    };
  }
  return base;
}

/** Self-check — fails if three-level model breaks. */
export function policyEngineSelfCheck(): void {
  const rules = policyPreset("balanced");
  const active = { rules, sessionActive: true, spentToday: "0" };

  const read = evaluatePolicy({ action: "get_balance" }, active);
  if (read.decision !== "AUTO_EXECUTE") {
    throw new Error("self-check: read should auto");
  }

  const quote = evaluatePolicy({ action: "get_swap_quote" }, active);
  if (quote.decision !== "AUTO_EXECUTE") {
    throw new Error("self-check: get_swap_quote should auto");
  }

  const quoteDenied = evaluatePolicy(
    { action: "get_swap_quote" },
    {
      rules: { ...rules, allowedActions: ["get_balance", "transfer"] },
      sessionActive: true,
    }
  );
  if (quoteDenied.decision !== "REJECTED") {
    throw new Error("self-check: get_swap_quote must respect allowedActions");
  }

  const small = evaluatePolicy(
    { action: "transfer", asset: "XLM", amount: "10", recipient: "GTEST" },
    active
  );
  if (small.decision !== "AUTO_EXECUTE") {
    throw new Error("self-check: small transfer should auto");
  }

  const mid = evaluatePolicy(
    { action: "transfer", asset: "XLM", amount: "16", recipient: "GTEST" },
    active
  );
  if (mid.decision !== "PENDING_APPROVAL") {
    throw new Error("self-check: mid transfer should need approval");
  }

  const big = evaluatePolicy(
    { action: "transfer", asset: "XLM", amount: "50", recipient: "GTEST" },
    active
  );
  if (big.decision !== "REJECTED") {
    throw new Error("self-check: over per-tx should reject");
  }

  const swapOk = evaluatePolicy(
    {
      action: "execute_swap",
      asset: "XLM",
      amount: "10",
      recipient: "USDC",
    },
    {
      rules: {
        ...rules,
        allowedActions: [...rules.allowedActions, "execute_swap"],
      },
      sessionActive: true,
      spentToday: "0",
    }
  );
  if (swapOk.decision !== "AUTO_EXECUTE") {
    throw new Error("self-check: small swap should auto");
  }

  const swapDenied = evaluatePolicy(
    {
      action: "execute_swap",
      asset: "XLM",
      amount: "1",
      recipient: "USDC",
    },
    active
  );
  if (swapDenied.decision !== "REJECTED") {
    throw new Error("self-check: execute_swap must be opt-in");
  }

  const x402Ok = evaluatePolicy(
    {
      action: "x402_fetch",
      asset: "XLM",
      amount: "0.1",
      recipient: "GDEMO",
    },
    {
      rules: {
        ...rules,
        allowedActions: [...rules.allowedActions, "x402_fetch"],
      },
      sessionActive: true,
      spentToday: "0",
    }
  );
  if (x402Ok.decision !== "AUTO_EXECUTE") {
    throw new Error("self-check: small x402_fetch should auto");
  }

  const x402Denied = evaluatePolicy(
    {
      action: "x402_fetch",
      asset: "XLM",
      amount: "0.1",
      recipient: "GDEMO",
    },
    active
  );
  if (x402Denied.decision !== "REJECTED") {
    throw new Error("self-check: x402_fetch must be opt-in");
  }

  const dead = evaluatePolicy(
    { action: "transfer", asset: "XLM", amount: "1", recipient: "GTEST" },
    { ...active, sessionActive: false }
  );
  if (dead.decision !== "REJECTED") {
    throw new Error("self-check: inactive session should reject");
  }
}
