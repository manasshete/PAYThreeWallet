/**
 * Push web production env for same-origin /api proxy.
 * Usage: node scripts/vercel-push-web-env.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = "paythreewallet";
const scope = "de-v8s-projects";
const apiOrigin = "https://pay3-api.vercel.app";
const site = "https://paythreewallet.vercel.app";

const vars = {
  NEXT_PUBLIC_API_URL: "/api",
  NEXT_PUBLIC_SITE_URL: site,
  NEXT_PUBLIC_STELLAR_NETWORK:
    "Public Global Stellar Network ; September 2015",
  API_PROXY_ORIGIN: apiOrigin,
};

function run(args, opts = {}) {
  return spawnSync("npx", ["vercel", ...args], {
    encoding: "utf8",
    shell: true,
    cwd: root,
    ...opts,
  });
}

run(["link", "--project", project, "--yes", "--scope", scope], {
  stdio: "inherit",
});

for (const [k, v] of Object.entries(vars)) {
  spawnSync("npx", ["vercel", "env", "rm", k, "production", "-y"], {
    shell: true,
    cwd: root,
    stdio: "ignore",
  });
  const r = spawnSync(
    "npx",
    ["vercel", "env", "add", k, "production"],
    { input: `${v}\n`, encoding: "utf8", shell: true, cwd: root }
  );
  console.log(k, r.status === 0 ? "PUSHED" : "FAIL", r.stderr?.slice(0, 120) ?? "");
}

console.log("redeploy web…");
const d = run(["deploy", "--prod", "--yes", "--scope", scope], {
  stdio: "inherit",
});
process.exit(d.status ?? 1);
