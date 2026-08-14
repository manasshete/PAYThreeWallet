/**
 * Soroban RPC / custom-account primitives (Phase 9c).
 * Session keys sign auth entries; relayer G-account pays fees only.
 */
import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Keypair,
  nativeToScVal,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  authorizeEntry,
  rpc,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk";

export const DEFAULT_SOROBAN_RPC =
  process.env.STELLAR_RPC_URL ?? "https://mainnet.sorobanrpc.com";

export type SorobanFailureClass =
  | "auth"
  | "policy"
  | "cap"
  | "insufficient_balance"
  | "expiry"
  | "revocation"
  | "technical"
  | "unknown";

/** Exact decimal XLM → stroops. No floating point on the contract path. */
export function xlmToStroops(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid XLM amount: ${amount}`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > 7) {
    throw new Error(`XLM amount has more than 7 decimal places: ${amount}`);
  }
  const fracPadded = (frac + "0000000").slice(0, 7);
  return BigInt(whole) * 10_000_000n + BigInt(fracPadded);
}

export function stroopsToXlm(stroops: bigint): string {
  const neg = stroops < 0n;
  const abs = neg ? -stroops : stroops;
  const whole = abs / 10_000_000n;
  const frac = (abs % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  const body = frac.length ? `${whole}.${frac}` : whole.toString();
  return neg ? `-${body}` : body;
}

export function getNetworkPassphrase(): string {
  return process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.PUBLIC;
}

export function getNativeSacContractId(
  networkPassphrase = getNetworkPassphrase()
): string {
  return (
    process.env.NATIVE_SAC_CONTRACT_ID ??
    Asset.native().contractId(networkPassphrase)
  );
}

export function getRpcServer(rpcUrl = DEFAULT_SOROBAN_RPC): rpc.Server {
  return new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
}

export function rawEd25519PublicKey(secretOrPublic: string): Buffer {
  if (secretOrPublic.startsWith("S")) {
    return Keypair.fromSecret(secretOrPublic).rawPublicKey();
  }
  return StrKey.decodeEd25519PublicKey(secretOrPublic);
}

/** Build a native SAC transfer(from=C, to, amount) op — unsigned. */
export function buildNativeSacTransferOp(opts: {
  contractAccountId: string;
  destination: string;
  amountStroops: bigint;
}): xdr.Operation {
  if (opts.amountStroops <= 0n) {
    throw new Error("amount must be positive stroops");
  }
  const sac = new Contract(getNativeSacContractId());
  return sac.call(
    "transfer",
    Address.fromString(opts.contractAccountId).toScVal(),
    Address.fromString(opts.destination).toScVal(),
    nativeToScVal(opts.amountStroops, { type: "i128" })
  );
}

export type ExpectedTransfer = {
  nativeSacId: string;
  fromContractId: string;
  destination: string;
  amountStroops: bigint;
};

/**
 * Reject any auth tree that is not exactly one native SAC transfer
 * matching from / to / amount.
 */
export function validateExactSacTransferAuth(
  auth: xdr.SorobanAuthorizationEntry[] | null | undefined,
  expected: ExpectedTransfer
): void {
  if (!auth || auth.length === 0) {
    throw new Error("auth tree empty — expected SAC transfer auth");
  }

  let matched = false;
  for (const entry of auth) {
    walkInvocation(entry.rootInvocation(), expected, (hit) => {
      if (matched) throw new Error("auth tree has multiple matching transfers");
      matched = hit;
    });
  }
  if (!matched) {
    throw new Error("auth tree missing exact native SAC transfer");
  }
}

function walkInvocation(
  inv: xdr.SorobanAuthorizedInvocation,
  expected: ExpectedTransfer,
  onTransfer: (matched: boolean) => void
): void {
  const fn = inv.function();
  const kind = fn.switch().name;

  if (kind === "sorobanAuthorizedFunctionTypeCreateContractHostFn" ||
      kind === "sorobanAuthorizedFunctionTypeCreateContractV2HostFn") {
    throw new Error("auth tree contains contract creation");
  }

  if (kind === "sorobanAuthorizedFunctionTypeContractFn") {
    const cfn = fn.contractFn();
    const contractId = Address.fromScAddress(cfn.contractAddress()).toString();
    const fnName = cfn.functionName().toString();
    const args = cfn.args();

    if (contractId === expected.fromContractId) {
      // Account contract self-invocation must not appear for session spends.
      throw new Error("auth tree authorizes smart-account method");
    }

    if (
      contractId === expected.nativeSacId &&
      fnName === "transfer" &&
      args.length >= 3
    ) {
      const from = Address.fromScVal(args[0]).toString();
      const to = Address.fromScVal(args[1]).toString();
      const amount = scValToBigInt(args[2]);
      const ok =
        from === expected.fromContractId &&
        to === expected.destination &&
        amount === expected.amountStroops;
      if (!ok) {
        throw new Error(
          `auth transfer mismatch: from=${from} to=${to} amount=${amount}`
        );
      }
      onTransfer(true);
    } else if (fnName === "transfer" || contractId === expected.nativeSacId) {
      throw new Error(`unexpected SAC invocation: ${contractId}.${fnName}`);
    }
  }

  for (const sub of inv.subInvocations()) {
    walkInvocation(sub, expected, onTransfer);
  }
}

function scValToBigInt(v: xdr.ScVal): bigint {
  const n = v.i128();
  const hi = BigInt(n.hi().toString());
  const lo = BigInt(n.lo().toString());
  return (hi << 64n) + (lo < 0n ? lo + (1n << 64n) : lo);
}

export async function signSessionAuthEntries(opts: {
  auth: xdr.SorobanAuthorizationEntry[];
  sessionSecret: string;
  contractAccountId: string;
  validUntilLedger: number;
  networkPassphrase?: string;
}): Promise<xdr.SorobanAuthorizationEntry[]> {
  const kp = Keypair.fromSecret(opts.sessionSecret);
  const passphrase = opts.networkPassphrase ?? getNetworkPassphrase();
  const out: xdr.SorobanAuthorizationEntry[] = [];

  // Zipper (P27): prefer AddressWithDelegates via SDK helpers when present.
  const sdk = await import("@stellar/stellar-sdk");
  const buildWithDelegates =
    "buildWithDelegatesEntry" in sdk
      ? (
          sdk as typeof sdk & {
            buildWithDelegatesEntry: (p: {
              entry: xdr.SorobanAuthorizationEntry;
              validUntilLedgerSeq: number;
              delegates: { address: string }[];
            }) => xdr.SorobanAuthorizationEntry;
          }
        ).buildWithDelegatesEntry
      : null;

  for (const entry of opts.auth) {
    const creds = entry.credentials();
    const switchName = creds.switch().name;

    if (
      switchName !== "sorobanCredentialsAddress" &&
      switchName !== "sorobanCredentialsAddressV2" &&
      switchName !== "sorobanCredentialsAddressWithDelegates"
    ) {
      out.push(entry);
      continue;
    }

    let topAddress: string;
    if (switchName === "sorobanCredentialsAddressWithDelegates") {
      topAddress = Address.fromScAddress(
        creds.addressWithDelegates().addressCredentials().address()
      ).toString();
    } else if (switchName === "sorobanCredentialsAddressV2") {
      topAddress = Address.fromScAddress(creds.addressV2().address()).toString();
    } else {
      topAddress = Address.fromScAddress(creds.address().address()).toString();
    }

    if (topAddress !== opts.contractAccountId) {
      out.push(entry);
      continue;
    }

    if (buildWithDelegates && switchName !== "sorobanCredentialsAddressWithDelegates") {
      let wrapped = buildWithDelegates({
        entry,
        validUntilLedgerSeq: opts.validUntilLedger,
        delegates: [{ address: kp.publicKey() }],
      });
      wrapped = await (authorizeEntry as (
        e: xdr.SorobanAuthorizationEntry,
        signer: Keypair,
        until: number,
        net: string,
        forAddress?: string
      ) => Promise<xdr.SorobanAuthorizationEntry>)(
        wrapped,
        kp,
        opts.validUntilLedger,
        passphrase,
        kp.publicKey()
      );
      out.push(wrapped);
      continue;
    }

    // Already WithDelegates, or legacy SDK — sign (optional forAddress on SDK 16+).
    const authorize = authorizeEntry as (
      e: xdr.SorobanAuthorizationEntry,
      signer: Keypair,
      until: number,
      net: string,
      forAddress?: string
    ) => Promise<xdr.SorobanAuthorizationEntry>;
    out.push(
      await authorize(
        entry,
        kp,
        opts.validUntilLedger,
        passphrase,
        kp.publicKey()
      )
    );
  }
  return out;
}

export async function buildSimulateSignContractPayment(opts: {
  relayerSecret: string;
  contractAccountId: string;
  sessionSecret: string;
  destination: string;
  amountXlm: string;
  rpcUrl?: string;
  /** When true, submit after assemble. Default false (interop proof). */
  submit?: boolean;
}): Promise<{
  hash: string | null;
  signedXdr: string;
  amountStroops: bigint;
}> {
  const amountStroops = xlmToStroops(opts.amountXlm);
  const passphrase = getNetworkPassphrase();
  const nativeSacId = getNativeSacContractId(passphrase);
  const server = getRpcServer(opts.rpcUrl);
  const relayer = Keypair.fromSecret(opts.relayerSecret);
  const source = await server.getAccount(relayer.publicKey());

  const op = buildNativeSacTransferOp({
    contractAccountId: opts.contractAccountId,
    destination: opts.destination,
    amountStroops,
  });

  let tx: Transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(op)
    .setTimeout(180)
    .build();

  // Recording simulation
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`recording simulation failed: ${sim.error}`);
  }
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error("recording simulation not successful");
  }

  const auth = sim.result?.auth ?? [];
  validateExactSacTransferAuth(auth, {
    nativeSacId,
    fromContractId: opts.contractAccountId,
    destination: opts.destination,
    amountStroops,
  });

  const latest = await server.getLatestLedger();
  const validUntil = latest.sequence + 50;
  const signedAuth = await signSessionAuthEntries({
    auth,
    sessionSecret: opts.sessionSecret,
    contractAccountId: opts.contractAccountId,
    validUntilLedger: validUntil,
    networkPassphrase: passphrase,
  });

  // Rebuild invoke with signed auth
  const builtOp = tx.operations[0] as {
    type: string;
    func: xdr.HostFunction;
    auth?: xdr.SorobanAuthorizationEntry[];
  };
  tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        func: builtOp.func,
        auth: signedAuth,
      })
    )
    .setTimeout(180)
    .build();

  const assembled = rpc.assembleTransaction(tx, sim).build();

  // Enforcing re-sim
  const enforce = await server.simulateTransaction(assembled);
  if (rpc.Api.isSimulationError(enforce)) {
    throw new Error(`enforcing simulation failed: ${enforce.error}`);
  }

  const finalTx = rpc.assembleTransaction(assembled, enforce).build();
  finalTx.sign(relayer);
  const signedXdr = finalTx.toXDR();

  if (!opts.submit) {
    return {
      hash: null,
      signedXdr,
      amountStroops,
    };
  }

  const sent = await submitSignedSorobanXdr({
    signedXdr,
    rpcUrl: opts.rpcUrl,
  });
  return { hash: sent.hash, signedXdr, amountStroops };
}

/**
 * Submit a previously signed XDR as-is (idempotent retry / ambiguous timeout).
 * Never rebuilds a second payment.
 */
export async function submitSignedSorobanXdr(opts: {
  signedXdr: string;
  rpcUrl?: string;
  knownHash?: string;
}): Promise<{ hash: string }> {
  const server = getRpcServer(opts.rpcUrl);

  if (opts.knownHash) {
    const existing = await server.getTransaction(opts.knownHash);
    if (existing.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash: opts.knownHash };
    }
    if (existing.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw Object.assign(new Error("known transaction failed on-chain"), {
        failureClass: "unknown" as SorobanFailureClass,
      });
    }
  }

  const sent = await server.sendTransaction(
    TransactionBuilder.fromXDR(opts.signedXdr, getNetworkPassphrase())
  );

  if (sent.status === "ERROR") {
    const cls = classifySorobanFailure(sent.errorResult?.toXDR("base64") ?? sent.status);
    throw Object.assign(new Error(`sendTransaction ERROR: ${sent.status}`), {
      failureClass: cls,
    });
  }

  const hash = sent.hash;
  // Poll until success/fail
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const got = await server.getTransaction(hash);
    if (got.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash };
    }
    if (got.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw Object.assign(new Error("soroban transaction failed"), {
        failureClass: "unknown" as SorobanFailureClass,
      });
    }
  }

  // Ambiguous timeout — caller should poll known hash, not rebuild.
  throw Object.assign(new Error(`soroban submit timeout hash=${hash}`), {
    failureClass: "technical" as SorobanFailureClass,
    hash,
  });
}

export function classifySorobanFailure(raw: string): SorobanFailureClass {
  const lower = raw.toLowerCase();
  if (lower.includes("sessionrevoked") || lower.includes("#4")) return "revocation";
  if (lower.includes("sessionexpired") || lower.includes("#3")) return "expiry";
  if (lower.includes("capexceeded") || lower.includes("#8")) return "cap";
  if (lower.includes("unauthorized") || lower.includes("badsignature")) return "auth";
  if (lower.includes("invalidcontext")) return "policy";
  if (
    lower.includes("insufficient") ||
    lower.includes("underfunded") ||
    lower.includes("balance")
  ) {
    return "insufficient_balance";
  }
  if (
    lower.includes("timeout") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("econnreset") ||
    lower.includes("network")
  ) {
    return "technical";
  }
  return "unknown";
}

/** Non-retryable financial / auth / policy failures. */
export function isRetryableSorobanFailure(cls: SorobanFailureClass): boolean {
  return cls === "technical";
}

export async function getContractXlmBalance(
  contractAccountId: string,
  rpcUrl?: string
): Promise<string> {
  const server = getRpcServer(rpcUrl);
  const sac = new Contract(getNativeSacContractId());
  // Use a throwaway sequence account for simulation-only reads.
  const phantom = Keypair.random().publicKey();
  const { Account } = await import("@stellar/stellar-sdk");
  const tx = new TransactionBuilder(new Account(phantom, "0"), {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      sac.call("balance", Address.fromString(contractAccountId).toScVal())
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`balance sim failed: ${sim.error}`);
    }
    return "0";
  }
  const stroops = scValToBigInt(sim.result.retval);
  return stroopsToXlm(stroops);
}

/** Fund C-account via native SAC transfer from a funded G-account (never Friendbot). */
export async function fundContractAccountFromG(opts: {
  funderSecret: string;
  contractAccountId: string;
  amountXlm: string;
  rpcUrl?: string;
}): Promise<{ hash: string }> {
  const amountStroops = xlmToStroops(opts.amountXlm);
  const server = getRpcServer(opts.rpcUrl);
  const funder = Keypair.fromSecret(opts.funderSecret);
  const source = await server.getAccount(funder.publicKey());
  const sac = new Contract(getNativeSacContractId());

  let tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      sac.call(
        "transfer",
        Address.fromString(funder.publicKey()).toScVal(),
        Address.fromString(opts.contractAccountId).toScVal(),
        nativeToScVal(amountStroops, { type: "i128" })
      )
    )
    .setTimeout(180)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`fund simulate failed: ${sim.error}`);
  }
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(funder);

  return submitSignedSorobanXdr({ signedXdr: tx.toXDR(), rpcUrl: opts.rpcUrl });
}

export async function uploadContractWasm(opts: {
  wasm: Buffer;
  deployerSecret: string;
  rpcUrl?: string;
}): Promise<{ wasmHash: string; hash: string }> {
  const server = getRpcServer(opts.rpcUrl);
  const deployer = Keypair.fromSecret(opts.deployerSecret);
  const source = await server.getAccount(deployer.publicKey());

  let tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      Operation.uploadContractWasm({ wasm: opts.wasm })
    )
    .setTimeout(180)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`upload simulate failed: ${sim.error}`);
  }
  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(deployer);
  const { hash } = await submitSignedSorobanXdr({
    signedXdr: tx.toXDR(),
    rpcUrl: opts.rpcUrl,
  });

  // WASM hash is SHA-256 of bytes
  const { createHash } = await import("node:crypto");
  const wasmHash = createHash("sha256").update(opts.wasm).digest("hex");
  return { wasmHash, hash };
}

export async function deploySmartAccountContract(opts: {
  wasmHashHex: string;
  deployerSecret: string;
  ownerGAddress: string;
  nativeSacId?: string;
  rpcUrl?: string;
}): Promise<{ contractId: string; hash: string }> {
  const server = getRpcServer(opts.rpcUrl);
  const deployer = Keypair.fromSecret(opts.deployerSecret);
  const source = await server.getAccount(deployer.publicKey());
  const nativeSac = opts.nativeSacId ?? getNativeSacContractId();
  const wasmHash = Buffer.from(opts.wasmHashHex, "hex");

  const salt = Keypair.random().rawPublicKey();
  let tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      Operation.createCustomContract({
        address: Address.fromString(deployer.publicKey()),
        wasmHash,
        salt,
        constructorArgs: [
          Address.fromString(opts.ownerGAddress).toScVal(),
          Address.fromString(nativeSac).toScVal(),
        ],
      })
    )
    .setTimeout(180)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`deploy simulate failed: ${sim.error}`);
  }

  let contractId: string | null = null;
  if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
    contractId = Address.fromScVal(sim.result.retval).toString();
  }

  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(deployer);
  const { hash } = await submitSignedSorobanXdr({
    signedXdr: tx.toXDR(),
    rpcUrl: opts.rpcUrl,
  });

  if (!contractId || !contractId.startsWith("C")) {
    const got = await server.getTransaction(hash);
    if (
      got.status === rpc.Api.GetTransactionStatus.SUCCESS &&
      got.returnValue
    ) {
      contractId = Address.fromScVal(got.returnValue).toString();
    }
  }
  if (!contractId || !contractId.startsWith("C")) {
    throw new Error("deploy succeeded but contract id not recoverable");
  }

  return { contractId, hash };
}

/** Build add_session / revoke_session invoke for Freighter owner auth (unsigned).
 * Zipper: session identity is the G-address (delegate), not raw ed25519 bytes.
 */
export function buildSessionAdminOp(opts: {
  contractAccountId: string;
  method: "add_session" | "revoke_session";
  sessionPublicKey: string;
  expiresLedger?: number;
  perTxMaxStroops?: bigint;
  sessionMaxStroops?: bigint;
}): xdr.Operation {
  const c = new Contract(opts.contractAccountId);
  const sessionAddr = Address.fromString(opts.sessionPublicKey);

  if (opts.method === "revoke_session") {
    return c.call("revoke_session", sessionAddr.toScVal());
  }

  if (
    opts.expiresLedger == null ||
    opts.perTxMaxStroops == null ||
    opts.sessionMaxStroops == null
  ) {
    throw new Error("add_session requires expiry and caps");
  }

  return c.call(
    "add_session",
    sessionAddr.toScVal(),
    nativeToScVal(opts.expiresLedger, { type: "u32" }),
    nativeToScVal(opts.perTxMaxStroops, { type: "i128" }),
    nativeToScVal(opts.sessionMaxStroops, { type: "i128" })
  );
}

/** Assert-based interop self-check (no network). */
export function stellarSorobanSelfCheck(): void {
  const assert = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(`stellarSorobanSelfCheck: ${msg}`);
  };

  assert(xlmToStroops("1") === 10_000_000n, "1 XLM stroops");
  assert(xlmToStroops("0.0000001") === 1n, "1 stroop");
  assert(xlmToStroops("12.3456789") === 123_456_789n, "exact decimals");
  assert(stroopsToXlm(10_000_000n) === "1", "stroops back to 1");

  let threw = false;
  try {
    xlmToStroops("1.00000001");
  } catch {
    threw = true;
  }
  assert(threw, "reject >7 decimals");

  threw = false;
  try {
    xlmToStroops("1e2");
  } catch {
    threw = true;
  }
  assert(threw, "reject scientific notation");

  const sac = getNativeSacContractId(Networks.TESTNET);
  assert(sac.startsWith("C"), "testnet native SAC id");

  // Zipper: session identity is a G-address (delegate), not AccSignature blobs
  const kp = Keypair.random();
  assert(kp.publicKey().startsWith("G"), "session delegate G-address");
  assert(Address.fromString(kp.publicKey()).toString() === kp.publicKey(), "Address roundtrip");

  assert(classifySorobanFailure("SessionExpired") === "expiry", "classify expiry");
  assert(classifySorobanFailure("CapExceeded") === "cap", "classify cap");
  assert(classifySorobanFailure("timeout 503") === "technical", "classify technical");
  assert(!isRetryableSorobanFailure("cap"), "cap not retryable");
  assert(isRetryableSorobanFailure("technical"), "technical retryable");

  const op = buildNativeSacTransferOp({
    contractAccountId: sac,
    destination: Keypair.random().publicKey(),
    amountStroops: 1n,
  });
  assert(op, "build transfer op");
}

if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("/soroban.ts")
) {
  stellarSorobanSelfCheck();
  console.log("stellarSorobanSelfCheck ok");
}
