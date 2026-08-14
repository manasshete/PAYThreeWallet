/**
 * Local MCP API smoke test (no Claude/Cursor required).
 * Usage (from repo root):
 *   set PAY3_MCP_TOKEN=pay3_...
 *   node scripts/smoke-mcp.mjs
 */
const API_URL = (process.env.PAY3_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  ""
);
const TOKEN = process.env.PAY3_MCP_TOKEN ?? "";

if (!TOKEN || TOKEN.includes("PASTE")) {
  console.error("Set PAY3_MCP_TOKEN to your session token first.");
  process.exit(1);
}

async function hit(path, init) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
}

const balance = await hit("/mcp/balance");
console.log("get_balance", balance.status, JSON.stringify(balance.body, null, 2));

const history = await hit("/mcp/history");
const txCount = Array.isArray(history.body?.transactions)
  ? history.body.transactions.length
  : 0;
console.log("get_transaction_history", history.status, `transactions=${txCount}`);

if (!balance.ok || !history.ok) {
  console.error("SMOKE FAILED — is the API running on", API_URL, "?");
  process.exit(1);
}

console.log("SMOKE OK — MCP API path works locally. Wire Cursor/Claude Desktop next.");
