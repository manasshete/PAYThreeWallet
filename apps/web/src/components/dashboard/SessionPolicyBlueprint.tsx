"use client";

import type { SessionPolicyRules } from "@pay3/shared";

const CLIENT_LABEL: Record<string, string> = {
  claude: "Claude",
  cursor: "Cursor",
  chatgpt: "ChatGPT",
  other: "MCP client",
};

type SessionPolicyBlueprintProps = {
  clientType: string;
  label: string;
  rules: SessionPolicyRules;
  mode?: "draft" | "review";
};

export function SessionPolicyBlueprint({
  clientType,
  label,
  rules,
  mode = "draft",
}: SessionPolicyBlueprintProps) {
  const initial = (label || clientType).charAt(0).toUpperCase();
  const swapOn = rules.allowedActions.includes("execute_swap");
  const x402On = rules.allowedActions.includes("x402_fetch");

  return (
    <div className="session-blueprint overflow-hidden rounded-[1.25rem] border border-white/[0.09] bg-[#09090b] shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
        <span className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] uppercase tracking-[0.16em] text-white/40">
          Policy blueprint
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.1em] ${
            mode === "review"
              ? "bg-amber-400/12 text-amber-300/90"
              : "bg-violet-400/12 text-violet-300/90"
          }`}
        >
          {mode === "review" ? "awaiting sign" : "drafting"}
        </span>
      </div>

      <div className="session-blueprint-canvas relative px-4 pb-4 pt-5">
        <div className="resolver-card-grid absolute inset-0 opacity-40" aria-hidden />
        <div className="resolver-card-vignette absolute inset-0" aria-hidden />

        <div className="resolver-box-field pointer-events-none absolute inset-0" aria-hidden>
          <div className="resolver-box absolute left-[6%] top-[10%] h-7 w-7 rotate-[12deg]" />
          <div className="resolver-box resolver-box-violet absolute right-[8%] top-[14%] h-5 w-5 -rotate-[10deg]" />
          <div className="resolver-box resolver-box-emerald absolute bottom-[12%] left-[10%] h-4 w-4 rotate-[30deg]" />
        </div>

        <div className="relative flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold uppercase text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {initial}
          </div>
          <p className="mt-3 font-[family-name:var(--font-space-grotesk)] text-[15px] font-semibold capitalize text-white/85">
            {label || CLIENT_LABEL[clientType] || clientType}
          </p>
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[10px] text-white/35">
            {CLIENT_LABEL[clientType] ?? clientType} · {rules.asset}
          </p>

          <div className="mt-5 grid w-full max-w-[14rem] grid-cols-2 gap-2">
            <LimitChip label="Duration" value={`${rules.durationHours}h`} />
            <LimitChip label="Daily" value={rules.dailyBudget} />
            <LimitChip label="Per tx" value={rules.perTxMax} />
            <LimitChip label="Approve" value={`>${rules.approvalAbove}`} />
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.1em] ${
                swapOn
                  ? "border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-300/80"
                  : "border-white/10 bg-white/[0.03] text-white/30"
              }`}
            >
              {swapOn ? "swap execute on" : "swap execute off"}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.1em] ${
                x402On
                  ? "border-violet-400/25 bg-violet-500/[0.08] text-violet-300/80"
                  : "border-white/10 bg-white/[0.03] text-white/30"
              }`}
            >
              {x402On ? "x402 on" : "x402 off"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.1em] text-white/35">
              freighter gate
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.07] px-4 py-3">
        <p className="font-[family-name:var(--font-jetbrains-mono)] text-[9px] leading-relaxed text-white/28">
          {mode === "review"
            ? "Sign to mint this policy into a live MCP session."
            : "Limits update live as you edit the form."}
        </p>
      </div>
    </div>
  );
}

function LimitChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2 text-center backdrop-blur-sm">
      <p className="font-[family-name:var(--font-jetbrains-mono)] text-[7px] uppercase tracking-[0.12em] text-white/28">
        {label}
      </p>
      <p className="mt-0.5 font-[family-name:var(--font-space-grotesk)] text-[13px] font-semibold tabular-nums text-white/85">
        {value}
      </p>
    </div>
  );
}
