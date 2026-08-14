/**
 * Dry-run: simulate WASM upload + smart-account deploy fees (no submit).
 *
 * Default: Stellar testnet (friendbot funds ephemeral account).
 * Mainnet: set SIM_NETWORK=mainnet + SIM_SOURCE_SECRET=S... (funded G).
 *
 * Usage: node scripts/simulate-deploy-cost.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  Address,
  Asset,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wasmPath = resolve(
  root,
  "contracts/smart-account/artifacts/pay3_smart_account.wasm"
);

const network = (process.env.SIM_NETWORK ?? "testnet").toLowerCase();
const isMainnet = network === "mainnet";

const RPC_URL = isMainnet
  ? process.env.STELLAR_RPC_URL ?? "https://mainnet.sorobanrpc.com"
  : process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";

const PASSPHRASE = isMainnet
  ? Networks.PUBLIC
  : Networks.TESTNET;

function stroopsToXlm(stroops) {
  const n = BigInt(stroops);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / 10_000_000n;
  const frac = (abs % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  const s = frac ? `${whole}.${frac}` : `${whole}`;
  return neg ? `-${s}` : s;
}

function feeFromSim(sim) {
  // minResourceFee is the Soroban resource fee (stroops)
  const resource = BigInt(sim.minResourceFee ?? "0");
  // inclusion fee ~ BASE_FEE (100 stroops) for a simple op; assembled tx fee is higher
  const inclusion = BigInt(BASE_FEE);
  return { resource, inclusion, total: resource + inclusion };
}

async function fundTestnet(publicKey) {
  const res = await fetch(
    `https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`friendbot failed: ${res.status} ${body.slice(0, 200)}`);
  }
}

async function main() {
  if (!existsSync(wasmPath)) {
    console.error("Missing WASM — run: cd contracts/smart-account && stellar contract build");
    process.exit(1);
  }

  const wasm = readFileSync(wasmPath);
  const wasmHash = createHash("sha256").update(wasm).digest("hex");
  console.log("=== Pay3 Smart Account deploy cost simulation ===");
  console.log("network:", network);
  console.log("rpc:", RPC_URL);
  console.log("wasm bytes:", wasm.length);
  console.log("wasm sha256:", wasmHash);
  console.log("");

  const server = new rpc.Server(RPC_URL, { allowHttp: false });
  let sourceKp;

  if (isMainnet) {
    const secret = process.env.SIM_SOURCE_SECRET?.trim();
    if (!secret?.startsWith("S")) {
      console.error(
        "Mainnet sim needs SIM_SOURCE_SECRET=S... (funded Freighter account)."
      );
      process.exit(1);
    }
    sourceKp = Keypair.fromSecret(secret);
    console.log("source G:", sourceKp.publicKey());
  } else {
    sourceKp = Keypair.random();
    console.log("ephemeral G:", sourceKp.publicKey());
    console.log("funding via friendbot…");
    await fundTestnet(sourceKp.publicKey());
    // brief wait for account to land
    await new Promise((r) => setTimeout(r, 2000));
  }

  const source = await server.getAccount(sourceKp.publicKey());

  // --- simulate upload ---
  let uploadTx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(Operation.uploadContractWasm({ wasm }))
    .setTimeout(180)
    .build();

  console.log("simulating uploadContractWasm…");
  const uploadSim = await server.simulateTransaction(uploadTx);
  if (rpc.Api.isSimulationError(uploadSim)) {
    console.error("upload simulate failed:", uploadSim.error);
    process.exit(1);
  }
  const uploadFees = feeFromSim(uploadSim);
  const uploadAssembled = rpc.assembleTransaction(uploadTx, uploadSim).build();
  const uploadTxFee = BigInt(uploadAssembled.fee);

  console.log("  minResourceFee (stroops):", uploadFees.resource.toString());
  console.log("  assembled tx fee (stroops):", uploadTxFee.toString());
  console.log("  ~XLM (assembled fee):", stroopsToXlm(uploadTxFee));
  console.log("");

  // Deploy sim needs the WASM hash on-ledger. On testnet we submit upload only,
  // then simulate deploy (no deploy submit). On mainnet, require prior upload or skip.
  let uploadSubmitFee = uploadTxFee;
  if (!isMainnet || process.env.SIM_SUBMIT_UPLOAD === "1") {
    console.log("submitting upload on", network, "(needed for deploy simulate)…");
    const signedUpload = rpc.assembleTransaction(uploadTx, uploadSim).build();
    signedUpload.sign(sourceKp);
    const send = await server.sendTransaction(signedUpload);
    if (send.status === "ERROR") {
      console.error("upload submit error:", send);
      process.exit(1);
    }
    let got;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      got = await server.getTransaction(send.hash);
      if (got.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) break;
    }
    if (got?.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      console.error("upload tx not successful:", got?.status, send.hash);
      process.exit(1);
    }
    uploadSubmitFee = BigInt(got.feeCharged ?? uploadTxFee.toString());
    console.log("  upload tx:", send.hash);
    console.log("  feeCharged (stroops):", uploadSubmitFee.toString());
    console.log("  feeCharged XLM:", stroopsToXlm(uploadSubmitFee));
    console.log("");
  }

  const source2 = await server.getAccount(sourceKp.publicKey());
  // Testnet native SAC from helpers; mainnet uses classic native SAC id
  const nativeSacId =
    process.env.NATIVE_SAC_CONTRACT_ID?.trim() ||
    Asset.native().contractId(PASSPHRASE);

  const salt = Keypair.random().rawPublicKey();
  const ownerG = process.env.SIM_OWNER_G?.trim() || sourceKp.publicKey();

  let deployTx = new TransactionBuilder(source2, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      Operation.createCustomContract({
        address: Address.fromString(sourceKp.publicKey()),
        wasmHash: Buffer.from(wasmHash, "hex"),
        salt,
        constructorArgs: [
          Address.fromString(ownerG).toScVal(),
          Address.fromString(nativeSacId).toScVal(),
        ],
      })
    )
    .setTimeout(180)
    .build();

  console.log("simulating createCustomContract (deploy + constructor) — no submit…");
  console.log("  owner:", ownerG);
  console.log("  native SAC:", nativeSacId);

  const deploySim = await server.simulateTransaction(deployTx);
  if (rpc.Api.isSimulationError(deploySim)) {
    console.error("deploy simulate failed:", deploySim.error);
    process.exit(1);
  }

  const deployFees = feeFromSim(deploySim);
  const deployAssembled = rpc.assembleTransaction(deployTx, deploySim).build();
  const deployTxFee = BigInt(deployAssembled.fee);

  console.log("  minResourceFee (stroops):", deployFees.resource.toString());
  console.log("  assembled tx fee (stroops):", deployTxFee.toString());
  console.log("  ~XLM (assembled fee):", stroopsToXlm(deployTxFee));

  const total = uploadSubmitFee + deployTxFee;
  // Round up to whole XLM for grant form buffer
  const ceilXlm = Math.ceil(Number(total) / 10_000_000);

  console.log("");
  console.log("=== FORM ANSWERS (from simulation) ===");
  console.log(`1) Pay3 Smart Account (Zipper CAP-71) – ${ceilXlm} XLM`);
  console.log(`Total XLM required: ${ceilXlm}`);
  console.log(
    `Exact estimated: ${stroopsToXlm(total)} XLM (upload ${stroopsToXlm(uploadSubmitFee)} + deploy ${stroopsToXlm(deployTxFee)})`
  );
  console.log("");
  console.log(
    "Rounded up for the form. Mainnet fees are usually similar; verify before mainnet submit."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
