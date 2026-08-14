import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const p of [
  resolve(process.cwd(), "apps/api/.env"),
  resolve(process.cwd(), "packages/database/.env"),
  resolve(process.cwd(), ".env"),
]) {
  if (existsSync(p)) config({ path: p });
}

const url = process.env.DATABASE_URL ?? "";
const placeholder =
  !url ||
  url.includes("USER:PASSWORD") ||
  url.includes("ep-xxxx") ||
  url.startsWith("file:");
console.log("database_url_set", Boolean(url));
console.log("would_use_memory", placeholder || !url.startsWith("postgres"));

if (placeholder) {
  console.log("fix: DATABASE_URL looks like a placeholder — auth falls back to memory OR fails if mis-detected");
  process.exit(0);
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({
  datasources: { db: { url } },
});

const t = setTimeout(() => {
  console.log("prisma_ok", false);
  console.log("prisma_err", "timeout after 8s — Neon may be paused or network blocked");
  process.exit(1);
}, 8000);

try {
  await prisma.$queryRaw`SELECT 1 as ok`;
  clearTimeout(t);
  console.log("prisma_ok", true);
  await prisma.$disconnect();
  process.exit(0);
} catch (e) {
  clearTimeout(t);
  console.log("prisma_ok", false);
  console.log(
    "prisma_err",
    e instanceof Error ? e.message.slice(0, 240) : String(e).slice(0, 240)
  );
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
}
