---
name: run-pay3
description: Start, run, smoke-test, and screenshot PAY3 (Express API on :4000 + Next.js web on :3000). Use when asked to run PAY3, start the dev servers, test login/auth or API routes, take a screenshot of the web UI, or stop the servers.
---

PAY3 is two dev servers — `apps/api` (Express, `tsx watch`, port 4000) and `apps/web` (Next.js 16 / Turbopack, port 3000, proxies `/api/*` to the API). Drive both with `.claude/skills/run-pay3/driver.mjs`: `start` launches them detached, `smoke` does HTTP checks **plus a full headless wallet login**, `shot` screenshots a page with headless Chrome/Edge, `stop` kills them.

All paths are relative to the repo root. Verified on Windows 11 + Git Bash, Node 24. The Linux branches in the driver (`lsof`, `pgrep`, `/usr/bin/chromium`) are unverified.

## Prerequisites

- Node 24 (`node -v` → v24.x), deps installed (`npm install` at repo root).
- Chrome or Edge installed (only for `shot`). Override with `PAY3_BROWSER=<path>`.
- **No `.env` needed.** Without `DATABASE_URL` the API uses in-memory auth (`/auth/status` → `"backend":"memory"`); users vanish on API restart. For Neon, put `DATABASE_URL` + `DIRECT_URL` in `apps/api/.env` (see `docs/DATABASE.md`).

## Run (agent path)

```bash
node .claude/skills/run-pay3/driver.mjs start    # runs `npm run db:generate` if the Prisma client is missing, launches both, waits for ready
node .claude/skills/run-pay3/driver.mjs smoke    # exit 0 = all PASS
node .claude/skills/run-pay3/driver.mjs shot /dashboard "$LOCALAPPDATA/Temp/pay3-run/shots/dashboard.png"
node .claude/skills/run-pay3/driver.mjs stop
```

Then **look at the PNG** (Read tool). Default `shot` output: `%TEMP%\pay3-run\shot.png`.
Logs: `%TEMP%\pay3-run\api.log`, `%TEMP%\pay3-run\web.log` (`os.tmpdir()/pay3-run` elsewhere).

| command | what it does |
|---|---|
| `start` | prisma generate if needed → `npm run dev:api` + `npm run dev` detached → polls `:4000/health` and `:3000/` |
| `smoke` | API `/health`, `/auth/status`, 401 on `/policy/presets`; web proxy `/api/health`; pages `/`, `/guide`, `/dashboard`; then random Stellar keypair → `POST /api/auth/challenge` → SEP-53 sign → `/api/auth/verify` → cookies → `/api/auth/me`, authed `/api/policy/presets`, logout |
| `shot <path> [out.png]` | headless Chrome/Edge, 1440×900, 8 s virtual time, own profile dir |
| `stop` | kills node processes whose command line is `tsx/dist` / `next/dist` under this repo, plus anything listening on 3000/4000 |

To log in from a script yourself, copy the auth block in `smoke()`: SEP-53 = `sha256("Stellar Signed Message:\n" + message)` signed with ed25519, base64. Session = cookies `pay3_session` + `pay3_uid`; `pay3_uid` is what authenticates requests.

## Run (human path)

```bash
npm run dev:api   # terminal 1 → http://localhost:4000
npm run dev       # terminal 2 → http://localhost:3000
```

The browser dashboard needs the Freighter extension (or Mobile QR) to log in. Headless, you only get the "Extension not found" card, so use `smoke` for authenticated flows.

## Test

```bash
npm run smoke:qr        # → "qr-login self-check OK"   (no servers needed)
npm run smoke:stellar   # → "stellarSorobanSelfCheck ok"
```

## Gotchas

- **The Prisma client isn't generated on a fresh clone**, and the API imports it even in memory mode, so it crashes at startup. `start` handles this. Manually: `npm run db:generate`. That's local codegen only and needs no DB.
- **Windows: servers died when the launching shell exited.** Spawning `npm` via a shell went through `npm.cmd`, and on exit cmd.exe got Ctrl-C (`Terminate batch job (Y/N)?` in api.log). The driver spawns `node …/npm/bin/npm-cli.js` directly with no shell. Don't "simplify" that back to `shell: true`.
- **Killing the `npm run` wrapper or a harness background task orphans the real servers** (`tsx watch` and `next dev` keep the ports). That's why `stop` matches by command line, not just by port. `netstat -ano -p tcp` also hides the IPv6 `[::]` listeners.
- **Git Bash mangles `/dashboard` into `C:/Program Files/Git/dashboard`.** `shot` undoes this. You can also pass `dashboard` without the slash.
- **`/login` is a 404.** Only `/login/qr/...` exists, and login lives on `/dashboard`.
- **Screenshots look dim or half-faded** because GSAP entrance animations get captured mid-transition. The content is correct, so don't treat this as a rendering bug.
- **Hydration-mismatch console error in a real Chrome** comes from a browser extension injecting `data-atm-ext-installed` on `<body>`. It's not an app bug.
- **The first request to each page is slow** (Turbopack compile takes about 4 s for `/`). `start` waits for `/` once, and the other pages compile on first hit.

## Troubleshooting

- **`@prisma/client did not initialize yet. Please run "prisma generate"`** in api.log: run `npm run db:generate`, then `stop` + `start`.
- **`start` reports ready in under 200 ms but api.log is empty**: old orphaned servers are still answering. Run `stop`, then `start`.
- **`auth challenge` FAIL with "auth storage unavailable"**: `DATABASE_URL` is set but unreachable or a placeholder. Fix the URL, or remove it to fall back to memory.
