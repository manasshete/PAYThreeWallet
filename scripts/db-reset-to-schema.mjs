import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const apiEnvPath = resolve(root, "apps/api/.env");
const dbEnvPath = resolve(root, "packages/database/.env");

const env = { ...process.env };
const kept = [];
for (const line of readFileSync(apiEnvPath, "utf8").split(/\r?\n/)) {
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
  if (k === "DATABASE_URL" || k === "DIRECT_URL") kept.push(`${k}=${v}`);
}

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL missing from apps/api/.env");
  process.exit(1);
}

// Keep prisma CLI and API on the same Neon URL
writeFileSync(dbEnvPath, kept.join("\n") + "\n");
console.log("synced packages/database/.env keys:", kept.map((l) => l.split("=")[0]).join(", "));

console.log("force-reset schema to match current Prisma models…");
const r = spawnSync(
  "npx",
  ["prisma", "db", "push", "--force-reset", "--accept-data-loss"],
  {
    env,
    cwd: resolve(root, "packages/database"),
    encoding: "utf8",
    shell: true,
  }
);
process.stdout.write(r.stdout ?? "");
process.stderr.write(r.stderr ?? "");
process.exit(r.status ?? 1);
