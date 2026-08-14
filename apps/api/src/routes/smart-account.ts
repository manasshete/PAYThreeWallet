import { Router } from "express";
import { prisma } from "@pay3/database";
import {
  createAllocationKeypair,
  ensureAllocationOnChain,
  formatXlm,
  getAccountBalances,
  getContractXlmBalance,
  getExplorerNetwork,
  isMainnet,
} from "@pay3/stellar";
import { encryptSecret } from "../crypto.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { isContractCustody, readContractOwner } from "../onchain-session.js";

export const smartAccountRouter = Router();

smartAccountRouter.use(requireAuth);

smartAccountRouter.get("/", async (req, res) => {
  const { userId } = req as AuthedRequest;

  const account = await prisma.smartAccount.findUnique({
    where: { userId },
  });

  if (!account || account.status === "pending" || !account.publicKey) {
    res.json({
      smartAccount: account
        ? {
            status: account.status,
            publicKey: null,
            contractRef: account.contractRef,
            custodyMode: account.custodyMode ?? "legacy",
            balances: [],
          }
        : null,
    });
    return;
  }

  const contractMode = isContractCustody(account);
  let balances: { asset: string; balance: string }[] = [];
  let xlmBalance = "0";
  let legacyXlmBalance: string | undefined;

  try {
    if (contractMode && account.contractRef?.startsWith("C")) {
      xlmBalance = formatXlm(await getContractXlmBalance(account.contractRef));
      balances = [{ asset: "XLM", balance: xlmBalance }];
      // Keep legacy G visible read-only during migration
      try {
        const legacy = await getAccountBalances(account.publicKey);
        const lx = legacy.find((b) => b.asset === "XLM");
        legacyXlmBalance = lx ? formatXlm(lx.balance) : "0";
      } catch {
        legacyXlmBalance = undefined;
      }
    } else {
      balances = await getAccountBalances(account.publicKey);
      const xlm = balances.find((b) => b.asset === "XLM");
      xlmBalance = xlm ? formatXlm(xlm.balance) : "0";
    }
  } catch (err) {
    console.error("balance fetch failed:", err);
  }

  res.json({
    smartAccount: {
      status: account.status,
      publicKey: account.publicKey,
      contractRef: account.contractRef,
      custodyMode: contractMode ? "contract" : "legacy",
      contractVersion: account.contractVersion,
      balances,
      xlmBalance,
      legacyXlmBalance,
      network: account.contractNetwork ?? (isMainnet() ? "mainnet" : "testnet"),
      model: contractMode ? "soroban-contract" : "allocation-account",
      explorerNetwork: getExplorerNetwork(),
    },
  });
});

/**
 * Opt-in canary: flip an already-deployed C-account into contract custody.
 * Does not deploy WASM — use scripts/canary-deploy.mjs for that.
 * Body: { contractRef, wasmHash?, contractVersion?, deployTxHash?, confirm: "ENABLE_CONTRACT_CUSTODY" }
 */
smartAccountRouter.post("/enable-contract-custody", async (req, res) => {
  const { userId, walletPublicKey } = req as AuthedRequest;
  const confirm = String(req.body?.confirm ?? "");
  const contractRef = String(req.body?.contractRef ?? "").trim();
  const wasmHash = req.body?.wasmHash ? String(req.body.wasmHash) : "";
  const allowedWasm = (process.env.PAY3_ALLOWED_WASM_HASHES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (confirm !== "ENABLE_CONTRACT_CUSTODY") {
    res.status(400).json({
      error: 'confirm must be "ENABLE_CONTRACT_CUSTODY"',
    });
    return;
  }
  if (!contractRef.startsWith("C")) {
    res.status(400).json({ error: "contractRef must be a C-address" });
    return;
  }
  if (allowedWasm.length > 0) {
    if (!wasmHash || !allowedWasm.includes(wasmHash.toLowerCase())) {
      res.status(400).json({
        error: "wasmHash not in PAY3_ALLOWED_WASM_HASHES allowlist",
      });
      return;
    }
  }

  const account = await prisma.smartAccount.findUnique({ where: { userId } });
  if (!account?.publicKey) {
    res.status(400).json({ error: "link a legacy smart account first" });
    return;
  }

  try {
    const onchainOwner = await readContractOwner(contractRef);
    if (onchainOwner !== walletPublicKey) {
      res.status(403).json({
        error: "on-chain owner does not match authenticated Freighter address",
        onchainOwner,
      });
      return;
    }
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : "failed to verify contract owner",
    });
    return;
  }

  const updated = await prisma.smartAccount.update({
    where: { userId },
    data: {
      custodyMode: "contract",
      contractRef,
      contractVersion: req.body?.contractVersion
        ? String(req.body.contractVersion)
        : "phase9c-v1",
      contractNetwork: isMainnet() ? "mainnet" : "testnet",
      wasmHash: wasmHash || undefined,
      deployTxHash: req.body?.deployTxHash
        ? String(req.body.deployTxHash)
        : undefined,
    },
  });

  res.json({
    smartAccount: {
      status: updated.status,
      publicKey: updated.publicKey,
      contractRef: updated.contractRef,
      custodyMode: updated.custodyMode,
      contractVersion: updated.contractVersion,
      model: "soroban-contract",
      rollback: "POST /smart-account/rollback-legacy",
    },
  });
});

/** Flip canary back to legacy G-account execution without deleting either record. */
smartAccountRouter.post("/rollback-legacy", async (req, res) => {
  const { userId } = req as AuthedRequest;
  const confirm = String(req.body?.confirm ?? "");
  if (confirm !== "ROLLBACK_LEGACY") {
    res.status(400).json({ error: 'confirm must be "ROLLBACK_LEGACY"' });
    return;
  }

  const account = await prisma.smartAccount.findUnique({ where: { userId } });
  if (!account?.publicKey || !account.encryptedSecret) {
    res.status(400).json({ error: "no legacy G-account to roll back to" });
    return;
  }

  const updated = await prisma.smartAccount.update({
    where: { userId },
    data: {
      custodyMode: "legacy",
      // Keep contractRef visible for audit; execution uses custodyMode.
    },
  });

  res.json({
    smartAccount: {
      status: updated.status,
      publicKey: updated.publicKey,
      contractRef: updated.contractRef,
      custodyMode: "legacy",
      model: "allocation-account",
      note: "Contract record retained; spends use legacy G-account again.",
    },
  });
});

smartAccountRouter.post("/link", async (req, res) => {
  const { userId } = req as AuthedRequest;

  const existing = await prisma.smartAccount.findUnique({
    where: { userId },
  });

  if (existing?.publicKey && existing.status !== "pending") {
    res.status(409).json({
      error: "smart account already linked",
      publicKey: existing.publicKey,
    });
    return;
  }

  try {
    const { publicKey, secret } = createAllocationKeypair();
    const funded = await ensureAllocationOnChain(publicKey);
    const encryptedSecret = encryptSecret(secret);
    const network = isMainnet() ? "mainnet" : "testnet";

    const account = existing
      ? await prisma.smartAccount.update({
          where: { userId },
          data: {
            publicKey,
            encryptedSecret,
            contractRef: publicKey,
            custodyMode: "legacy",
            contractNetwork: network,
            status: "linked",
          },
        })
      : await prisma.smartAccount.create({
          data: {
            userId,
            publicKey,
            encryptedSecret,
            contractRef: publicKey,
            custodyMode: "legacy",
            contractNetwork: network,
            status: "linked",
          },
        });

    res.status(201).json({
      smartAccount: {
        status: account.status,
        publicKey: account.publicKey,
        custodyMode: "legacy",
        network,
        model: "allocation-account",
        fundedByFriendbot: funded.method === "friendbot",
        fundingMethod: funded.method,
        needsFunding: funded.method === "none",
        createAccountHash: funded.hash,
      },
    });
  } catch (err) {
    console.error("smart-account/link failed:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "failed to link smart account",
    });
  }
});
