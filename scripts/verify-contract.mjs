/**
 * Verify a Pay3 Smart Account contract on Stellar mainnet.
 * Usage: node scripts/verify-contract.mjs [contractId]
 */
import {
  Contract,
  Keypair,
  TransactionBuilder,
  Account,
  rpc,
  Address,
  Networks,
} from "@stellar/stellar-sdk";
import { StrKey } from "@stellar/stellar-base";

const CONTRACT =
  process.argv[2]?.trim() ||
  "CAIIDPX4S3U7E66IAF4RHTVWBXIJOCEZC45Z546V3FLAUAYSFNOCT3OO";
const EXPECTED_WASM =
  "842c28f0f4db756cfbe259553993fd1045c0df32966b4bebff9d94720490e5e0";
const NATIVE_SAC =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
const server = new rpc.Server("https://mainnet.sorobanrpc.com");
const passphrase = Networks.PUBLIC;

if (!CONTRACT.startsWith("C")) {
  console.error("Invalid contract id");
  process.exit(1);
}

try {
  StrKey.decodeContract(CONTRACT);
} catch (e) {
  console.error("Invalid C-address:", e.message);
  process.exit(1);
}

async function simulate(fn) {
  const c = new Contract(CONTRACT);
  const phantom = Keypair.random().publicKey();
  const tx = new TransactionBuilder(new Account(phantom, "0"), {
    fee: "100",
    networkPassphrase: passphrase,
  })
    .addOperation(c.call(fn))
    .setTimeout(30)
    .build();
  return server.simulateTransaction(tx);
}

console.log("contractId:", CONTRACT);
console.log("network: Stellar public mainnet");

let ok = true;

for (const fn of ["owner", "native_sac"]) {
  const sim = await simulate(fn);
  if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
    const val = Address.fromScVal(sim.result.retval).toString();
    console.log(`${fn}:`, val);
    if (fn === "native_sac" && val !== NATIVE_SAC) {
      ok = false;
      console.log("native_sac: unexpected SAC id");
    }
  } else {
    ok = false;
    console.log(
      `${fn}: FAILED`,
      rpc.Api.isSimulationError(sim) ? sim.error : "no retval"
    );
  }
}

const meta = await fetch(
  `https://api.stellar.expert/explorer/public/contract/${CONTRACT}`
).then((r) => r.json());
if (meta.wasm === EXPECTED_WASM) {
  console.log("wasmHash:", meta.wasm, "✅ matches Pay3 Zipper build");
} else {
  ok = false;
  console.log("wasmHash:", meta.wasm ?? "unknown", "❌ mismatch");
}

console.log(
  ok ? "\n✅ Pay3 Smart Account verified on mainnet" : "\n❌ Verification failed"
);
process.exit(ok ? 0 : 1);
