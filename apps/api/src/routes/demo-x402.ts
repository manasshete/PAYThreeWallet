import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  parseX402PaymentHeader,
  type X402Accept,
} from "../x402.js";
import { verifyX402Payment } from "../x402-service.js";

export const demoX402Router = Router();

function demoAccept(resource: string): X402Accept {
  const payTo =
    process.env.X402_DEMO_PAYEE_G?.trim() ||
    process.env.X402_DEMO_RECIPIENT?.trim() ||
    "";
  if (!payTo.startsWith("G")) {
    return {
      amount: "0.1",
      asset: "XLM",
      payTo: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      resource,
      memo: "demo-not-configured",
    };
  }
  return {
    amount: process.env.X402_DEMO_AMOUNT?.trim() || "0.1",
    asset: "XLM",
    payTo,
    resource,
    memo: randomUUID().slice(0, 8),
  };
}

/**
 * Demo paid API — returns 402 until X-Payment header with valid Stellar tx.
 * GET /demo/x402/insight
 */
demoX402Router.get("/insight", async (req, res) => {
  const resource = "/demo/x402/insight";
  const accept = demoAccept(resource);

  if (!accept.payTo.startsWith("G") || accept.payTo.includes("XXXX")) {
    res.status(503).json({
      error: "x402 demo not configured",
      hint: "Set X402_DEMO_PAYEE_G on the API to a mainnet/testnet G-address",
    });
    return;
  }

  const proof = parseX402PaymentHeader(
    typeof req.headers["x-payment"] === "string"
      ? req.headers["x-payment"]
      : undefined
  );

  if (!proof) {
    res.status(402).json({
      x402Version: 1,
      error: "Payment Required",
      accepts: [
        {
          scheme: "stellar",
          amount: accept.amount,
          asset: accept.asset,
          payTo: accept.payTo,
          resource: accept.resource,
          memo: accept.memo,
        },
      ],
    });
    return;
  }

  const ok = await verifyX402Payment({ txHash: proof, accept });
  if (!ok) {
    res.status(402).json({
      x402Version: 1,
      error: "Payment invalid or insufficient",
      accepts: [
        {
          scheme: "stellar",
          amount: accept.amount,
          asset: accept.asset,
          payTo: accept.payTo,
          resource: accept.resource,
        },
      ],
    });
    return;
  }

  res.json({
    resource,
    data: {
      summary: "Paid insight unlocked via x402",
      network: process.env.STELLAR_NETWORK_PASSPHRASE?.includes("Public")
        ? "mainnet"
        : "testnet",
      paymentTx: proof,
      quote: "AI agents can pay per call — policy-gated through Pay3.",
    },
  });
});
