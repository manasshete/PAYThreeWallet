import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// ponytail: cwd-based dotenv so CJS/Vercel bundles don't need import.meta
for (const p of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "apps/api/.env"),
  resolve(process.cwd(), "../../.env"),
]) {
  if (existsSync(p)) config({ path: p });
}
