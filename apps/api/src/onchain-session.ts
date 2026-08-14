/**
 * Build / confirm on-chain session registration & revocation (Phase 9c).
 * Owner Freighter signs; relayer never holds the owner key.
 */
import {
  Address,
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";
import {
  buildSessionAdminOp,
  getNativeSacContractId,
  getNetworkPassphrase,
  getRpcServer,
  submitSignedSorobanXdr,
  xlmToStroops,
} from "@pay3/stellar";
import type { SessionPolicyRules } from "@pay3/session-manager";

const LEDGERS_PER_HOUR = 720; // ~5s/ledger

export function estimateExpiresLedger(
  latestLedger: number,
  durationHours: number
): number {
  return latestLedger + Math.max(1, durationHours) * LEDGERS_PER_HOUR;
}

export async function prepareAddSessionTx(opts: {
  contractId: string;
  ownerGAddress: string;
  sessionPublicKey: string;
  rules: SessionPolicyRules;
  expiresLedger: number;
}): Promise<{ unsignedXdr: string; expiresLedger: number }> {
  const server = getRpcServer();
  const source = await server.getAccount(opts.ownerGAddress);
  const perTx = xlmToStroops(opts.rules.perTxMax);
  const sessionMax = xlmToStroops(opts.rules.dailyBudget);

  const op = buildSessionAdminOp({
    contractAccountId: opts.contractId,
    method: "add_session",
    sessionPublicKey: opts.sessionPublicKey,
    expiresLedger: opts.expiresLedger,
    perTxMaxStroops: perTx,
    sessionMaxStroops: sessionMax,
  });

  let tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(op)
    .setTimeout(300)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`add_session simulate failed: ${sim.error}`);
  }
  tx = rpc.assembleTransaction(tx, sim).build();
  return { unsignedXdr: tx.toXDR(), expiresLedger: opts.expiresLedger };
}

export async function prepareRevokeSessionTx(opts: {
  contractId: string;
  ownerGAddress: string;
  sessionPublicKey: string;
}): Promise<{ unsignedXdr: string }> {
  const server = getRpcServer();
  const source = await server.getAccount(opts.ownerGAddress);
  const op = buildSessionAdminOp({
    contractAccountId: opts.contractId,
    method: "revoke_session",
    sessionPublicKey: opts.sessionPublicKey,
  });

  let tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(op)
    .setTimeout(300)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`revoke_session simulate failed: ${sim.error}`);
  }
  tx = rpc.assembleTransaction(tx, sim).build();
  return { unsignedXdr: tx.toXDR() };
}

export async function submitOwnerSignedTx(signedXdr: string): Promise<{ hash: string }> {
  return submitSignedSorobanXdr({ signedXdr });
}

export function isContractCustody(account: {
  custodyMode?: string | null;
}): boolean {
  // custodyMode is authoritative — do not infer from retained C… contractRef
  // (rollback keeps contractRef for audit while flipping mode to legacy).
  return account.custodyMode === "contract";
}

/** Assert signed XDR invokes the expected session admin method on our contract. */
export function assertSessionAdminTx(opts: {
  signedXdr: string;
  contractId: string;
  method: "add_session" | "revoke_session";
  sessionPublicKey: string;
}): void {
  const tx = TransactionBuilder.fromXDR(
    opts.signedXdr,
    getNetworkPassphrase()
  );
  const envelope = tx.toEnvelope();
  const operations = envelope.v1().tx().operations();
  if (operations.length < 1) {
    throw new Error("signed tx has no operations");
  }
  const body = operations[0].body();
  if (body.switch().name !== "invokeHostFunction") {
    throw new Error("signed tx is not invokeHostFunction");
  }
  const hostFn = body.invokeHostFunctionOp().hostFunction();
  if (hostFn.switch().name !== "hostFunctionTypeInvokeContract") {
    throw new Error("signed tx is not a contract invoke");
  }
  const invoke = hostFn.invokeContract();
  const contractId = Address.fromScAddress(invoke.contractAddress()).toString();
  if (contractId !== opts.contractId) {
    throw new Error("signed tx targets unexpected contract");
  }
  const fnName = invoke.functionName().toString();
  if (fnName !== opts.method) {
    throw new Error(`signed tx method ${fnName} != ${opts.method}`);
  }
  const args = invoke.args();
  if (args.length < 1) {
    throw new Error("signed tx missing session address arg");
  }
  const got = Address.fromScVal(args[0]).toString();
  if (got !== opts.sessionPublicKey) {
    throw new Error("signed tx session address mismatch");
  }
}

/** Read on-chain owner Address for a smart account contract. */
export async function readContractOwner(
  contractId: string
): Promise<string> {
  const server = getRpcServer();
  const { Contract, Account } = await import("@stellar/stellar-sdk");
  const c = new Contract(contractId);
  const phantom = Keypair.random().publicKey();
  const tx = new TransactionBuilder(new Account(phantom, "0"), {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(c.call("owner"))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) {
    throw new Error(
      rpc.Api.isSimulationError(sim)
        ? `owner sim failed: ${sim.error}`
        : "owner sim failed"
    );
  }
  return Address.fromScVal(sim.result.retval).toString();
}

export { getNativeSacContractId, getRpcServer, Address, Keypair, Operation };
