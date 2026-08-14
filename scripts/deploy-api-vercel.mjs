/**
 * Stage a slim API deploy for Vercel (@vercel/node) and push env + prod deploy.
 * Does not print secret values.
 *
 * Usage: node scripts/deploy-api-vercel.mjs
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = join(tmpdir(), `pay3-api-deploy-${Date.now()}`);
const project = "pay3-api";
const scope = "de-v8s-projects";
const webOrigin = "https://paythreewallet.vercel.app";

const envKeys = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SMART_ACCOUNT_ENCRYPTION_KEY",
  "STELLAR_NETWORK_PASSPHRASE",
  "STELLAR_HORIZON_URL",
  "STELLAR_RPC_URL",
  "NATIVE_SAC_CONTRACT_ID",
  "RELAYER_SECRET",
  "SOROSWAP_API_KEY",
  "SOROSWAP_API_URL",
  "SOROSWAP_NETWORK",
  "PAY3_ALLOWED_WASM_HASHES",
  "X402_DEMO_PAYEE_G",
  "X402_DEMO_AMOUNT",
];

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: true,
    ...opts,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0 && !opts.allowFail) {
    process.exit(r.status ?? 1);
  }
  return r;
}

function loadEnvFile(file) {
  const map = {};
  if (!existsSync(file)) return map;
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
    map[k] = v;
  }
  return map;
}

console.log("generate prisma + bundle api…");
// ponytail: local Windows locks query_engine DLL while API is running
if (process.env.SKIP_DB_GENERATE !== "1") {
  run("npm", ["run", "db:generate"], { cwd: root });
} else {
  console.log("SKIP_DB_GENERATE=1");
}
run("node", ["scripts/bundle-api.mjs"], { cwd: root });

if (!existsSync(join(root, "api/server.cjs"))) {
  console.error("missing api/server.cjs");
  process.exit(1);
}

console.log("stage", stage);
mkdirSync(stage, { recursive: true });
mkdirSync(join(stage, "api"), { recursive: true });
mkdirSync(join(stage, "prisma"), { recursive: true });

writeFileSync(
  join(stage, "package.json"),
  JSON.stringify(
    {
      name: "pay3-api-vercel",
      private: true,
      scripts: { postinstall: "prisma generate" },
      dependencies: {
        "@prisma/client": "^6.19.3",
        prisma: "^6.19.3",
      },
    },
    null,
    2
  )
);

cpSync(join(root, "api/index.js"), join(stage, "api/index.js"));
cpSync(join(root, "api/server.cjs"), join(stage, "api/server.cjs"));
cpSync(join(root, "vercel.api.json"), join(stage, "vercel.json"));
cpSync(
  join(root, "packages/database/prisma/schema.prisma"),
  join(stage, "prisma/schema.prisma")
);

run("npx", ["vercel", "link", "--project", project, "--yes", "--scope", scope], {
  cwd: stage,
});

const local = {
  ...loadEnvFile(join(root, ".env")),
  ...loadEnvFile(join(root, "apps/api/.env")),
};
const toPush = {
  NODE_ENV: "production",
  WEB_ORIGIN: webOrigin,
  STELLAR_NETWORK_PASSPHRASE:
    local.STELLAR_NETWORK_PASSPHRASE ??
    "Public Global Stellar Network ; September 2015",
  STELLAR_HORIZON_URL:
    local.STELLAR_HORIZON_URL ?? "https://horizon.stellar.org",
};
for (const k of envKeys) {
  if (local[k]) toPush[k] = local[k];
}

if (process.env.SKIP_ENV_PUSH !== "1") {
  for (const [k, v] of Object.entries(toPush)) {
    run("npx", ["vercel", "env", "rm", k, "production", "-y"], {
      cwd: stage,
      allowFail: true,
      stdio: "ignore",
    });
    const r = run("npx", ["vercel", "env", "add", k, "production"], {
      cwd: stage,
      input: `${v}\n`,
      allowFail: true,
    });
    console.log(k, r.status === 0 ? "PUSHED" : "FAIL");
  }
} else {
  console.log("SKIP_ENV_PUSH=1");
}

console.log("deploy…");
run("npx", ["vercel", "deploy", "--prod", "--yes", "--scope", scope], {
  cwd: stage,
});
console.log("done → https://pay3-api.vercel.app/health");
