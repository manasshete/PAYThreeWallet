/**
 * Bundle Express API to api/server.cjs for Vercel (@vercel/node).
 * Prisma stays external (native engines).
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const r = spawnSync(
  "npx",
  [
    "--yes",
    "esbuild",
    "apps/api/src/app.ts",
    "--bundle",
    "--platform=node",
    "--target=node20",
    "--format=cjs",
    "--outfile=api/server.cjs",
    "--external:@prisma/client",
    "--external:.prisma/client",
  ],
  { cwd: root, encoding: "utf8", shell: true }
);
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
if (r.status !== 0) process.exit(r.status ?? 1);
console.log("wrote api/server.cjs");
