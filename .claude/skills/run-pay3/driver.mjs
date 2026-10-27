#!/usr/bin/env node
// Agent driver for PAY3 (API on :4000 + Next.js web on :3000).
//   node .claude/skills/run-pay3/driver.mjs start          # generate prisma if needed, launch both, wait ready
//   node .claude/skills/run-pay3/driver.mjs smoke          # HTTP checks + headless wallet login + authed calls
//   node .claude/skills/run-pay3/driver.mjs shot /guide out.png   # headless Chrome/Edge screenshot
//   node .claude/skills/run-pay3/driver.mjs stop           # kill whatever listens on :4000 / :3000
import { spawn, spawnSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, openSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const API = process.env.PAY3_API ?? "http://localhost:4000";
const WEB = process.env.PAY3_WEB ?? "http://localhost:3000";
const LOG_DIR = join(tmpdir(), "pay3-run");
const IS_WIN = process.platform === "win32";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, label, timeoutMs = 120_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (r.status < 500) return console.log(`ready: ${label} (${r.status}) in ${Date.now() - t0}ms`);
    } catch {}
    await sleep(1000);
  }
  throw new Error(`${label} not ready after ${timeoutMs}ms — see ${LOG_DIR}`);
}

function prismaGenerated() {
  const f = join(ROOT, "node_modules/.prisma/client/default.js");
  return existsSync(f) && !readFileSync(f, "utf8").includes("did not initialize yet");
}

function launch(name, npmScript) {
  const log = join(LOG_DIR, `${name}.log`);
  const fd = openSync(log, "w");
  // Windows: no shell / npm.cmd — when the launching terminal exits, cmd.exe gets Ctrl-C
  // ("Terminate batch job (Y/N)?") and the server dies. Run npm-cli.js under node directly.
  const npmCli = join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
  const [bin, argv] = IS_WIN
    ? [process.execPath, [npmCli, "run", npmScript]]
    : ["npm", ["run", npmScript]];
  const child = spawn(bin, argv, {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", fd, fd],
    windowsHide: true,
  });
  child.unref();
  console.log(`launched ${name} (npm run ${npmScript}) -> ${log}`);
}

async function start() {
  mkdirSync(LOG_DIR, { recursive: true });
  if (!prismaGenerated()) {
    console.log("prisma client not generated — running npm run db:generate");
    const r = spawnSync(IS_WIN ? "npm.cmd" : "npm", ["run", "db:generate"], { cwd: ROOT, shell: IS_WIN, stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  launch("api", "dev:api");
  launch("web", "dev");
  await waitFor(`${API}/health`, "api");
  // first request compiles the page under Turbopack — slow
  await waitFor(`${WEB}/`, "web");
}

// Dev servers whose command line points into this repo (tsx watch for api, next for web).
// Port lookup alone misses some listeners on Windows, and killing the npm wrapper leaves orphans.
function devServerPids() {
  const pattern = "tsx[\\\\/]dist|next[\\\\/]dist|apps[\\\\/]web[\\\\/]\\.next";
  try {
    if (IS_WIN) {
      const root = ROOT.replace(/'/g, "''");
      const ps = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ` +
        `Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${root}') -and $_.CommandLine -match '${pattern}' } | ` +
        `ForEach-Object { $_.ProcessId }`;
      return execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`, { encoding: "utf8" })
        .split(/\s+/).filter(Boolean);
    }
    return execSync(`pgrep -f '${ROOT}.*(tsx/dist|next/dist|apps/web/.next)'`, { encoding: "utf8" })
      .split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

function pidsOnPort(port) {
  try {
    if (IS_WIN) {
      // no `-p tcp`: that hides the IPv6 ([::]) listeners
      const out = execSync(`netstat -ano`, { encoding: "utf8" });
      return [...new Set(out.split(/\r?\n/)
        .filter((l) => /LISTENING/.test(l) && new RegExp(`:${port}\\s`).test(l))
        .map((l) => l.trim().split(/\s+/).pop())
        .filter((p) => p && p !== "0"))];
    }
    return execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" }).split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

function stop() {
  const pids = new Set([...devServerPids(), ...pidsOnPort(4000), ...pidsOnPort(3000)]);
  for (const pid of pids) {
    try {
      if (IS_WIN) execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      else process.kill(Number(pid), "SIGTERM");
      console.log(`killed pid ${pid}`);
    } catch {
      // already gone as part of an earlier /T tree kill
    }
  }
  if (!pids.size) console.log("nothing running");
}

let failures = 0;
function check(label, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

async function req(base, path, { method = "GET", body, cookie } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text, setCookie: r.headers.getSetCookie?.() ?? [] };
}

async function smoke() {
  const { Keypair } = await import("@stellar/stellar-sdk");

  let r = await req(API, "/health");
  check("api /health", r.status === 200 && r.json?.ok === true, r.text.slice(0, 80));
  r = await req(API, "/auth/status");
  check("api /auth/status", r.status === 200, r.text);
  r = await req(API, "/policy/presets");
  check("api /policy/presets unauthenticated -> 401", r.status === 401);
  r = await req(WEB, "/api/health");
  check("web proxy /api/health -> api", r.status === 200 && r.json?.service === "pay3-api");
  for (const p of ["/", "/guide", "/dashboard"]) {
    r = await req(WEB, p);
    check(`web page ${p}`, r.status === 200, `${r.status}`);
  }

  // Headless wallet login: throwaway keypair signs the SEP-53 challenge (same as Freighter would).
  // Goes through the web proxy so the cookie path matches what the browser uses.
  const kp = Keypair.random();
  r = await req(WEB, "/api/auth/challenge", { method: "POST", body: { publicKey: kp.publicKey() } });
  check("auth challenge", r.status === 200 && !!r.json?.nonce, r.json?.error ?? "");
  if (r.status !== 200) return;
  const { nonce, message } = r.json;
  const hash = createHash("sha256")
    .update(Buffer.concat([Buffer.from("Stellar Signed Message:\n"), Buffer.from(message)]))
    .digest();
  const signature = kp.sign(hash).toString("base64");
  r = await req(WEB, "/api/auth/verify", { method: "POST", body: { publicKey: kp.publicKey(), signature, nonce } });
  check("auth verify (SEP-53 signature)", r.status === 200 && !!r.json?.user, r.json?.error ?? `user ${r.json?.user?.id}`);
  const cookie = r.setCookie.map((c) => c.split(";")[0]).join("; ");
  check("session cookies set", /pay3_session=/.test(cookie) && /pay3_uid=/.test(cookie));

  r = await req(WEB, "/api/auth/me", { cookie });
  check("auth/me returns user", r.json?.user?.publicKey === kp.publicKey(), r.text.slice(0, 120));
  r = await req(WEB, "/api/policy/presets", { cookie });
  check("policy/presets authenticated -> 200", r.status === 200, r.text.slice(0, 120));
  r = await req(WEB, "/api/auth/logout", { method: "POST", cookie });
  check("logout", r.status === 200);

  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

function findBrowser() {
  const candidates = IS_WIN
    ? [
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
      ]
    : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  return process.env.PAY3_BROWSER ?? candidates.find(existsSync);
}

async function shot(path = "/", out = join(LOG_DIR, "shot.png")) {
  // Git Bash rewrites "/dashboard" to "C:/Program Files/Git/dashboard" — undo it
  path = "/" + path.replace(/^[A-Za-z]:[\\/].*?[\\/]Git[\\/]?/, "").replace(/^\/+/, "");
  const browser = findBrowser();
  if (!browser) throw new Error("no Chrome/Edge found — set PAY3_BROWSER");
  mkdirSync(dirname(resolve(out)), { recursive: true });
  // own profile dir so it doesn't collide with the user's running Chrome
  const profile = join(LOG_DIR, "chrome-profile");
  const r = spawnSync(browser, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${profile}`,
    "--window-size=1440,900", "--virtual-time-budget=8000", `--screenshot=${resolve(out)}`, WEB + path,
  ], { stdio: "ignore", timeout: 90_000 });
  if (!existsSync(out) || statSync(out).size === 0) throw new Error(`screenshot failed (exit ${r.status})`);
  console.log(`screenshot ${WEB + path} -> ${resolve(out)}`);
}

const [cmd, ...args] = process.argv.slice(2);
const cmds = { start, smoke, shot: () => shot(...args), stop };
if (!cmds[cmd]) {
  console.log("usage: driver.mjs start | smoke | shot <path> [out.png] | stop");
  process.exit(2);
}
await cmds[cmd]();
