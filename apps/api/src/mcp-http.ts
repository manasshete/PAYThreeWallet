/**
 * Hosted MCP over Streamable HTTP (stateless + JSON).
 * Exact path POST/GET/DELETE /mcp — REST tools stay at /mcp/balance|transfer|history.
 *
 * ponytail: stateless so Vercel serverless needs no sticky session map;
 * upgrade to sticky/stateful only if a host requires resumable SSE.
 */
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import * as z from "zod/v4";
import {
  extractMcpToken,
  resolveMcpToken,
} from "./middleware/mcp-auth.js";
import {
  mcpGetBalance,
  mcpGetHistory,
  mcpGetSwapQuote,
  mcpExecuteSwap,
  mcpTransfer,
  mcpX402Fetch,
  type McpSessionCtx,
} from "./mcp-service.js";

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

function createPay3McpServer(ctx: McpSessionCtx): McpServer {
  const server = new McpServer(
    { name: "pay3", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "get_balance",
    {
      description:
        "Get the Pay3 smart-account (allocation) balances for the authenticated AI session.",
      inputSchema: {
        asset: z
          .string()
          .optional()
          .describe("Optional asset filter, e.g. XLM"),
      },
    },
    async ({ asset }) => {
      const result = await mcpGetBalance(ctx, asset ?? null);
      return textResult(result.body, result.status >= 400);
    }
  );

  server.registerTool(
    "transfer",
    {
      description:
        "Transfer funds from the Pay3 allocation account. Recipient can be a saved contact name or a Stellar G-address. Never guess ambiguous names.",
      inputSchema: {
        recipient: z
          .string()
          .describe("Contact name or Stellar public key"),
        asset: z
          .string()
          .default("XLM")
          .describe("Asset code (XLM for MVP)"),
        amount: z.string().describe("Amount to send as a decimal string"),
        idempotency_key: z
          .string()
          .optional()
          .describe("Optional idempotency key to prevent duplicate payments"),
      },
    },
    async ({ recipient, asset, amount, idempotency_key }) => {
      const result = await mcpTransfer(ctx, {
        recipient,
        asset,
        amount,
        idempotencyKey: idempotency_key,
      });
      return textResult(result.body, result.status >= 400);
    }
  );

  server.registerTool(
    "get_transaction_history",
    {
      description:
        "List recent Pay3 transfers and Horizon payments for this session's allocation account.",
      inputSchema: {},
    },
    async () => {
      const result = await mcpGetHistory(ctx);
      return textResult(result.body, result.status >= 400);
    }
  );

  server.registerTool(
    "get_swap_quote",
    {
      description:
        "Get a read-only DeFi swap quote via Soroswap aggregator (Soroswap/Phoenix/Aqua). Does not execute a swap.",
      inputSchema: {
        asset_in: z
          .string()
          .describe("Input asset symbol (XLM, USDC) or C… contract id"),
        asset_out: z
          .string()
          .describe("Output asset symbol (XLM, USDC) or C… contract id"),
        amount: z.string().describe("Amount as a decimal string, e.g. 1.5"),
        trade_type: z
          .enum(["EXACT_IN", "EXACT_OUT"])
          .optional()
          .describe("Default EXACT_IN"),
      },
    },
    async ({ asset_in, asset_out, amount, trade_type }) => {
      const result = await mcpGetSwapQuote(ctx, {
        assetIn: asset_in,
        assetOut: asset_out,
        amount,
        tradeType: trade_type,
      });
      return textResult(result.body, result.status >= 400);
    }
  );

  server.registerTool(
    "execute_swap",
    {
      description:
        "Execute a DeFi swap via Soroswap aggregator (quote→build→sign→send). Opt-in session action. Does not auto-retry financial failures. Legacy G allocation only.",
      inputSchema: {
        asset_in: z
          .string()
          .describe("Input asset symbol (XLM, USDC) or C… contract id"),
        asset_out: z
          .string()
          .describe("Output asset symbol (XLM, USDC) or C… contract id"),
        amount: z.string().describe("Amount as a decimal string, e.g. 1.5"),
        trade_type: z
          .enum(["EXACT_IN", "EXACT_OUT"])
          .optional()
          .describe("Default EXACT_IN"),
        slippage_bps: z
          .number()
          .optional()
          .describe("Slippage in basis points (default 50 = 0.5%)"),
        idempotency_key: z
          .string()
          .optional()
          .describe("Optional idempotency key"),
      },
    },
    async ({
      asset_in,
      asset_out,
      amount,
      trade_type,
      slippage_bps,
      idempotency_key,
    }) => {
      const result = await mcpExecuteSwap(ctx, {
        assetIn: asset_in,
        assetOut: asset_out,
        amount,
        tradeType: trade_type,
        slippageBps: slippage_bps,
        idempotencyKey: idempotency_key,
      });
      return textResult(result.body, result.status >= 400);
    }
  );

  server.registerTool(
    "x402_fetch",
    {
      description:
        "Fetch a paywalled HTTP API using x402 (402 Payment Required). Pays via policy-gated Stellar transfer, then retries with X-Payment proof. Opt-in session action.",
      inputSchema: {
        url: z.string().describe("HTTP(S) URL to fetch (allowlisted hosts only)"),
        max_amount: z
          .string()
          .optional()
          .describe("Optional max XLM to pay if API returns 402"),
        idempotency_key: z.string().optional(),
      },
    },
    async ({ url, max_amount, idempotency_key }) => {
      const result = await mcpX402Fetch(ctx, {
        url,
        maxAmount: max_amount,
        idempotencyKey: idempotency_key,
      });
      return textResult(result.body, result.status >= 400);
    }
  );

  return server;
}

export async function handleMcpHttp(
  req: Request,
  res: Response
): Promise<void> {
  if (req.method === "GET" || req.method === "DELETE") {
    res
      .status(405)
      .set("Allow", "POST")
      .json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).set("Allow", "POST").end();
    return;
  }

  const auth = await resolveMcpToken(extractMcpToken(req));
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const server = createPay3McpServer({
    userId: auth.userId,
    sessionId: auth.sessionId,
  });
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("hosted MCP error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  } finally {
    // ponytail: JSON/stateless responses finish in one shot; close after handle
    void transport.close();
    void server.close();
  }
}
