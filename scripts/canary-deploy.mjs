/**
 * Phase 9c canary: upload WASM, deploy one contract, fund via SAC, print enable payload.
 *
 * Required env (never commit secrets):
 *   CANARY_DEPLOYER_SECRET  — funded G (fees + upload/deploy)
 *   CANARY_OWNER_G          — Freighter owner G-address
 *   CANARY_OWNER_SECRET     — same owner secret (for raw pk); OR set CANARY_OWNER_PK_HEX
 *   CANARY_FUNDER_SECRET    — funded G to SAC-transfer XLM into C (can = deployer)
 *
 * Optional:
 *   STELLAR_RPC_URL, STELLAR_NETWORK_PASSPHRASE, CANARY_FUND_XLM (default 5)
 *
 * Usage: node scripts/canary-deploy.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@stellar/stellar-sdk";
import {
  deploySmartAccountContract,
  fundContractAccountFromG,
  getContractXlmBalance,
  getNativeSacContractId,
  uploadContractWasm,
  stellarSorobanSelfCheck,
} from "@pay3/stellar";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wasmPath = resolve(
  root,
  "contracts/smart-account/artifacts/pay3_smart_account.wasm"
);

function loadDotEnv() {
  for (const rel of [".env", "apps/api/.env"]) {
    const p = resolve(root, rel);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadDotEnv();
stellarSorobanSelfCheck();

const deployerSecret = process.env.CANARY_DEPLOYER_SECRET?.trim();
const ownerG = process.env.CANARY_OWNER_G?.trim();
const funderSecret =
  process.env.CANARY_FUNDER_SECRET?.trim() || deployerSecret;
const fundXlm = process.env.CANARY_FUND_XLM?.trim() || "5";

if (!deployerSecret?.startsWith("S") || !ownerG?.startsWith("G")) {
  console.error(
    "Set CANARY_DEPLOYER_SECRET and CANARY_OWNER_G (and optionally CANARY_FUNDER_SECRET)."
  );
  process.exit(1);
}

if (!existsSync(wasmPath)) {
  console.error("Missing WASM at", wasmPath, "— run stellar contract build first");
  process.exit(1);
}

const wasm = readFileSync(wasmPath);
console.log("native SAC", getNativeSacContractId());
console.log("uploading WASM…");
const uploaded = await uploadContractWasm({
  wasm,
  deployerSecret,
});
console.log("wasmHash", uploaded.wasmHash);
console.log("uploadTx", uploaded.hash);

console.log("deploying contract…");
const deployed = await deploySmartAccountContract({
  wasmHashHex: uploaded.wasmHash,
  deployerSecret,
  ownerGAddress: ownerG,
});
console.log("contractId", deployed.contractId);
console.log("deployTx", deployed.hash);

console.log(`funding ${fundXlm} XLM via SAC…`);
const funded = await fundContractAccountFromG({
  funderSecret,
  contractAccountId: deployed.contractId,
  amountXlm: fundXlm,
});
console.log("fundTx", funded.hash);

const bal = await getContractXlmBalance(deployed.contractId);
console.log("contract balance XLM", bal);

console.log("\n--- Enable canary on linked user (API) ---");
console.log(
  JSON.stringify(
    {
      confirm: "ENABLE_CONTRACT_CUSTODY",
      contractRef: deployed.contractId,
      wasmHash: uploaded.wasmHash,
      contractVersion: "phase9c-v1",
      deployTxHash: deployed.hash,
    },
    null,
    2
  )
);
console.log(
  "\nPOST /smart-account/enable-contract-custody with the JSON above (auth required)."
);
console.log(
  "Rollback: POST /smart-account/rollback-legacy { confirm: \"ROLLBACK_LEGACY\" }"
);
console.log(
  "No automatic G-account sweep. Drain legacy only via explicit user action later."
);
