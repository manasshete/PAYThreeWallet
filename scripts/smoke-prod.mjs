/**
 * Production launch smoke (no Freighter UI).
 * Usage: node scripts/smoke-prod.mjs
 */
const API = (process.env.PAY3_API_URL ?? "https://pay3-api.vercel.app").replace(
  /\/$/,
  ""
);
const WEB = (
  process.env.PAY3_WEB_URL ?? "https://paythreewallet.vercel.app"
).replace(/\/$/, "");

async function check(name, fn) {
  try {
    await fn();
    console.log("OK ", name);
  } catch (e) {
    console.error("FAIL", name, e.message ?? e);
    process.exitCode = 1;
  }
}

await check("api /health", async () => {
  const r = await fetch(`${API}/health`);
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(JSON.stringify(j));
});

await check("web landing", async () => {
  const r = await fetch(WEB);
  if (!r.ok) throw new Error(`status ${r.status}`);
  const html = await r.text();
  if (!/pay3/i.test(html)) throw new Error("missing Pay3 brand on landing");
});

await check("web /api/health proxy", async () => {
  const r = await fetch(`${WEB}/api/health`);
  const j = await r.json();
  if (!r.ok || !j.ok) throw new Error(JSON.stringify(j));
});

await check("mcp rejects missing token", async () => {
  const r = await fetch(`${API}/mcp/balance`);
  if (r.status === 200) throw new Error("expected auth failure");
  if (r.status < 400) throw new Error(`unexpected status ${r.status}`);
});

await check("auth challenge endpoint", async () => {
  const r = await fetch(`${API}/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    }),
  });
  // invalid key may 400; route must exist (not 404/502)
  if (r.status === 404 || r.status >= 500) {
    throw new Error(`status ${r.status}`);
  }
});

if (process.env.PAY3_MCP_TOKEN) {
  await check("mcp get_balance (token)", async () => {
    const r = await fetch(`${API}/mcp/balance`, {
      headers: { Authorization: `Bearer ${process.env.PAY3_MCP_TOKEN}` },
    });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
  });
} else {
  console.log("SKIP mcp authenticated — set PAY3_MCP_TOKEN for full MCP smoke");
}

console.log(process.exitCode ? "SMOKE FAILED" : "SMOKE OK — prod URLs reachable");
