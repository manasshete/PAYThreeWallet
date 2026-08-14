/**
 * Validates production env keys are present (does not print values).
 * Usage: node scripts/prod-env-check.mjs path/to/.env
 */
import { readFileSync, existsSync } from "node:fs";

const file = process.argv[2] ?? "apps/api/.env";
const required = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SMART_ACCOUNT_ENCRYPTION_KEY",
  "WEB_ORIGIN",
];

if (!existsSync(file)) {
  console.error("MISSING_FILE", file);
  process.exit(1);
}

const text = readFileSync(file, "utf8");
const keys = new Set(
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => l.split("=")[0].trim())
);

let ok = true;
for (const k of required) {
  const present = keys.has(k);
  const line = text
    .split(/\r?\n/)
    .find((l) => l.startsWith(k + "="));
  const val = line ? line.slice(k.length + 1).replace(/^["']|["']$/g, "") : "";
  const weak =
    !val ||
    val.includes("change-me") ||
    val.includes("USER:PASSWORD") ||
    val.includes("ep-xxxx");
  console.log(k, present && !weak ? "OK" : "NEED_SET");
  if (!present || weak) ok = false;
}

process.exit(ok ? 0 : 1);
