/**
 * Push apps/api/.env keys to a Vercel project (production).
 * Does not print secret values.
 *
 * Usage: node scripts/vercel-push-env.mjs pay3-api
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const project = process.argv[2] ?? "pay3-api";
const file = process.argv[3] ?? "apps/api/.env";
const keys = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SMART_ACCOUNT_ENCRYPTION_KEY",
  "STELLAR_NETWORK_PASSPHRASE",
  "STELLAR_HORIZON_URL",
];

const extras = {
  NODE_ENV: "production",
  WEB_ORIGIN: "https://paythreewallet.vercel.app",
};

if (!existsSync(file)) {
  console.error("missing", file);
  process.exit(1);
}

const map = { ...extras };
for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const i = t.indexOf("=");
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (keys.includes(k)) map[k] = v;
}

for (const [k, v] of Object.entries(map)) {
  // remove existing quietly then add
  spawnSync(
    "npx",
    ["vercel", "env", "rm", k, "production", "-y", "--project", project],
    { stdio: "ignore", shell: true }
  );
  const r = spawnSync(
    "npx",
    ["vercel", "env", "add", k, "production", "--project", project],
    { input: v + "\n", encoding: "utf8", shell: true }
  );
  console.log(k, r.status === 0 ? "PUSHED" : "FAIL");
}
