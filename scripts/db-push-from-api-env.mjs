import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const envPath = resolve(import.meta.dirname, "../apps/api/.env");
const env = { ...process.env };
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
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
  env[k] = v;
}

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL missing from apps/api/.env");
  process.exit(1);
}

console.log("pushing schema to Neon…");
const r = spawnSync(
  "npx",
  ["prisma", "db", "push", "--accept-data-loss"],
  {
    env,
    cwd: resolve(import.meta.dirname, "../packages/database"),
    encoding: "utf8",
    shell: true,
  }
);
process.stdout.write(r.stdout ?? "");
process.stderr.write(r.stderr ?? "");
process.exit(r.status ?? 1);
