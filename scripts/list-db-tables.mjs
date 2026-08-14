import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const envPath = resolve(import.meta.dirname, "../apps/api/.env");
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
  process.env[k] = v;
}

const prisma = new PrismaClient();
const rows = await prisma.$queryRawUnsafe(
  "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1"
);
console.log(JSON.stringify(rows, null, 2));
await prisma.$disconnect();
