#!/usr/bin/env node
/**
 * Pay3 MCP server (stdio).
 * Env:
 *   PAY3_API_URL   — default http://localhost:4000
 *   PAY3_MCP_TOKEN — session token from dashboard (shown once)
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = (process.env.PAY3_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  ""
);
const TOKEN = process.env.PAY3_MCP_TOKEN ?? "";

if (!TOKEN) {
  console.error("PAY3_MCP_TOKEN is required");
  process.exit(1);
}

async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function textResult(data: unknown, isError = false) {
  return {
    content: [
      {
        type: "text" as const,
        text:
          typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
    isError,
  };
}

const server = new Server(
  { name: "pay3", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_balance",
      description:
        "Get the Pay3 smart-account (allocation) balances for the authenticated AI session.",
      inputSchema: {
        type: "object",
        properties: {
          asset: {
            type: "string",
            description: "Optional asset filter, e.g. XLM",
          },
        },
      },
    },
    {
      name: "transfer",
      description:
        "Transfer funds from the Pay3 allocation account. Recipient can be a saved contact name or a Stellar G-address. Never guess ambiguous names.",
      inputSchema: {
        type: "object",
        properties: {
          recipient: {
            type: "string",
            description: "Contact name or Stellar public key",
          },
          asset: {
            type: "string",
            description: "Asset code (XLM for MVP)",
            default: "XLM",
          },
          amount: {
            type: "string",
            description: "Amount to send as a decimal string",
          },
          idempotency_key: {
            type: "string",
            description: "Optional idempotency key to prevent duplicate payments",
          },
        },
        required: ["recipient", "amount"],
      },
    },
    {
      name: "get_transaction_history",
      description:
        "List recent Pay3 transfers and Horizon payments for this session's allocation account.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_swap_quote",
      description:
        "Get a read-only DeFi swap quote via Soroswap aggregator (Soroswap/Phoenix/Aqua). Does not execute a swap.",
      inputSchema: {
        type: "object",
        properties: {
          asset_in: {
            type: "string",
            description: "Input asset symbol (XLM, USDC) or C… contract id",
          },
          asset_out: {
            type: "string",
            description: "Output asset symbol (XLM, USDC) or C… contract id",
          },
          amount: {
            type: "string",
            description: "Amount as a decimal string, e.g. 1.5",
          },
          trade_type: {
            type: "string",
            description: "EXACT_IN (default) or EXACT_OUT",
          },
        },
        required: ["asset_in", "asset_out", "amount"],
      },
    },
    {
      name: "execute_swap",
      description:
        "Execute a DeFi swap via Soroswap (quote→build→sign→send). Opt-in session action. Legacy G allocation only.",
      inputSchema: {
        type: "object",
        properties: {
          asset_in: {
            type: "string",
            description: "Input asset symbol (XLM, USDC) or C… contract id",
          },
          asset_out: {
            type: "string",
            description: "Output asset symbol (XLM, USDC) or C… contract id",
          },
          amount: {
            type: "string",
            description: "Amount as a decimal string, e.g. 1.5",
          },
          trade_type: {
            type: "string",
            description: "EXACT_IN (default) or EXACT_OUT",
          },
          slippage_bps: {
            type: "number",
            description: "Slippage in basis points (default 50)",
          },
          idempotency_key: {
            type: "string",
            description: "Optional idempotency key",
          },
        },
        required: ["asset_in", "asset_out", "amount"],
      },
    },
    {
      name: "x402_fetch",
      description:
        "Fetch a paywalled HTTP API (x402). Pays via policy-gated Stellar transfer then retries with payment proof. Opt-in.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "HTTP(S) URL (allowlisted hosts)" },
          max_amount: {
            type: "string",
            description: "Optional max XLM to pay on 402",
          },
          idempotency_key: { type: "string" },
        },
        required: ["url"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  try {
    if (name === "get_balance") {
      const q = args.asset ? `?asset=${encodeURIComponent(String(args.asset))}` : "";
      const { ok, body } = await apiFetch(`/mcp/balance${q}`);
      return textResult(body, !ok);
    }

    if (name === "transfer") {
      const { ok, body } = await apiFetch("/mcp/transfer", {
        method: "POST",
        body: JSON.stringify({
          recipient: args.recipient,
          asset: args.asset ?? "XLM",
          amount: args.amount,
          idempotencyKey: args.idempotency_key,
        }),
      });
      return textResult(body, !ok);
    }

    if (name === "get_transaction_history") {
      const { ok, body } = await apiFetch("/mcp/history");
      return textResult(body, !ok);
    }

    if (name === "get_swap_quote") {
      const { ok, body } = await apiFetch("/mcp/swap-quote", {
        method: "POST",
        body: JSON.stringify({
          assetIn: args.asset_in ?? args.assetIn,
          assetOut: args.asset_out ?? args.assetOut,
          amount: args.amount,
          tradeType: args.trade_type ?? args.tradeType,
        }),
      });
      return textResult(body, !ok);
    }

    if (name === "execute_swap") {
      const { ok, body } = await apiFetch("/mcp/swap", {
        method: "POST",
        body: JSON.stringify({
          assetIn: args.asset_in ?? args.assetIn,
          assetOut: args.asset_out ?? args.assetOut,
          amount: args.amount,
          tradeType: args.trade_type ?? args.tradeType,
          slippageBps: args.slippage_bps ?? args.slippageBps,
          idempotencyKey: args.idempotency_key ?? args.idempotencyKey,
        }),
      });
      return textResult(body, !ok);
    }

    if (name === "x402_fetch") {
      const { ok, body } = await apiFetch("/mcp/x402-fetch", {
        method: "POST",
        body: JSON.stringify({
          url: args.url,
          maxAmount: args.max_amount ?? args.maxAmount,
          idempotencyKey: args.idempotency_key ?? args.idempotencyKey,
        }),
      });
      return textResult(body, !ok);
    }

    return textResult({ error: `Unknown tool: ${name}` }, true);
  } catch (err) {
    return textResult(
      {
        error: err instanceof Error ? err.message : "MCP tool call failed",
      },
      true
    );
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
