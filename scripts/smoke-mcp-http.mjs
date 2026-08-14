/**
 * Hosted Streamable HTTP MCP self-check (initialize + tools/list).
 * Usage:
 *   set PAY3_MCP_TOKEN=pay3_...
 *   node scripts/smoke-mcp-http.mjs
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

async function rpc(body) {
  const res = await fetch(`${API_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { status: res.status, json };
}

const noAuth = await fetch(`${API_URL}/mcp`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0" },
    },
  }),
});
if (noAuth.status !== 401 && noAuth.status !== 403) {
  console.error("FAIL: expected 401 without token, got", noAuth.status);
  process.exit(1);
}
console.log("OK  auth required", noAuth.status);

const init = await rpc({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "smoke-mcp-http", version: "0.1.0" },
  },
});
if (init.status >= 400 || init.json?.error) {
  console.error("FAIL initialize", init.status, init.json);
  process.exit(1);
}
console.log("OK  initialize", init.status);

const tools = await rpc({
  jsonrpc: "2.0",
  id: 2,
  method: "tools/list",
  params: {},
});
const names = (tools.json?.result?.tools ?? []).map((t) => t.name).sort();
const expected = [
  "execute_swap",
  "get_balance",
  "get_swap_quote",
  "get_transaction_history",
  "transfer",
].sort();
if (JSON.stringify(names) !== JSON.stringify(expected)) {
  console.error("FAIL tools/list", tools.status, names, tools.json);
  process.exit(1);
}
console.log("OK  tools/list", names.join(", "));

// REST path still works for local stdio MCP
const bal = await fetch(`${API_URL}/mcp/balance`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
if (!bal.ok) {
  console.error("FAIL REST /mcp/balance", bal.status);
  process.exit(1);
}
console.log("OK  REST /mcp/balance");

console.log("SMOKE OK — hosted MCP at", `${API_URL}/mcp`);
