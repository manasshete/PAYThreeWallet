/**
 * Probe Soroswap quote paths (no key printed).
 * Usage: node scripts/smoke-soroswap-quote.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const rel of ["apps/api/.env", ".env"]) {
    const p = resolve(root, rel);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnv();

const apiKey = process.env.SOROSWAP_API_KEY?.trim();
if (!apiKey) {
  console.error("SOROSWAP_API_KEY missing");
  process.exit(1);
}

async function tryQuote(label, base, network, body) {
  const res = await fetch(`${base}/quote?network=${network}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(label, res.status, text.slice(0, 280));
}

const TEST_XLM = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const TEST_USDC_A = "CDWEFYYHMGEZEFC5TBUDXM3IJJ7K7W5BDGE765UIYQEV4JFWDOLSTOEK";
const TEST_USDC_B = "CBBHRKEP5M3NUDRISGLJKGHDHX3DA2CN2AZBQY6WLVUJ7VNLGSKBDUCM";
const MAIN_USDC = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const MAIN_XLM = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

const body = (assetIn, assetOut) => ({
  assetIn,
  assetOut,
  amount: "10000000",
  tradeType: "EXACT_IN",
  protocols: ["soroswap", "phoenix", "aqua", "sdex"],
  slippageBps: 50,
});

await tryQuote(
  "prod/test/usdcDocs",
  "https://api.soroswap.finance",
  "testnet",
  body(TEST_XLM, TEST_USDC_B)
);
await tryQuote(
  "prod/test/usdcLegacy",
  "https://api.soroswap.finance",
  "testnet",
  body(TEST_XLM, TEST_USDC_A)
);
await tryQuote(
  "staging/test/usdcA",
  "https://staging-api.soroswap.finance",
  "testnet",
  body(TEST_XLM, TEST_USDC_A)
);
await tryQuote(
  "prod/main/xlm-usdc",
  "https://api.soroswap.finance",
  "mainnet",
  body(MAIN_XLM, MAIN_USDC)
);
