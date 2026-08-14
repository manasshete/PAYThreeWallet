# Pay3 Implementation Plan (v2)

> **Audited against:** `maincontext.md` (full product spec — **source of truth**)  
> **Also:** `context.md` (landing/marketing shorthand) · current repo (landing page only)

---

## Document map

| File | Role |
|------|------|
| `maincontext.md` | Full product: architecture, security, MVP scope, user journey, roadmap |
| `context.md` | Shorter copy aligned with landing page; good for marketing, not implementation detail |
| `docs/IMPLEMENTATION_PLAN.md` | **This file** — how to build it, in order |

**Landing page** = user journey step 1 only (`maincontext.md` §37).  
**Product** = dashboard + API + MCP + policy + Soroban smart account (`maincontext.md` §6–7).

---

## 1. Current state

| Component | Status | `maincontext.md` ref |
|-----------|--------|----------------------|
| Marketing site (`/`) | ✅ Done | §37 step 1 |
| Wallet connect + signature auth | ❌ | §10 |
| Soroban smart account | ❌ | §11, §32 #3 |
| Manual fund allocation to smart account | ❌ | §12–13 |
| AI sessions (per client) | ❌ | §14–15 |
| Encrypted session-key storage | ❌ | §16 |
| Explicit permission review UI | ❌ | §17 |
| Hybrid policy engine (off-chain first) | ❌ | §20–22 |
| Recipient resolver (never guess) | ❌ | §23 |
| Transaction engine + lifecycle | ❌ | §24, §29 |
| MCP server (3 tools) | ❌ | §30 |
| Manual MCP config | ❌ | §31 |
| Dashboard (control plane) | ❌ | §7, §32 #21 |

---

## 2. North star demo

> User connects Freighter → creates smart account + allocates testnet USDC → creates **Claude session** with permission review + wallet sign-off → pastes MCP config → asks Claude *"Pay 5 USDC to Hurain"* → recipient resolved from saved contact → policy auto-executes → tx on Stellar testnet → history + audit updated.

This matches `maincontext.md` §24 (complete payment flow) and §37 (full journey).

---

## 3. Critical corrections from full spec

### ❌ Previous plan mistake: MCP before sessions
`maincontext.md` §37 steps 8–13: user **creates session + authorizes with wallet** before MCP works.  
**Fix:** Sessions + policy + contacts **before** MCP `transfer`.

### ❌ Previous plan mistake: smart account only at week 8
§32 lists smart account as MVP item #3 — not optional late add-on.  
**Fix:** Smart account **link + manual funding UI** by week 2–3; Soroban **on-chain enforcement** hardens in parallel (§20, §45).

### ❌ Missing: permission review screen
§17 — no silent AI authority. User must see ALLOWED/BLOCKED summary and sign with wallet.

### ❌ Missing: recipient rules
§23 — never guess; ambiguous name → stop and ask user.

### ❌ Missing: transaction lifecycle + idempotency from day one of transfers
§27–29 — not “hardening later.”

---

## 4. MVP technology stack (`maincontext.md` §33)

| Layer | Choice |
|-------|--------|
| Web | Next.js, React, TypeScript, Tailwind, **shadcn/ui** (dashboard) |
| API | **Express.js**, TypeScript |
| DB | PostgreSQL (Neon), Prisma |
| Chain | Stellar JS SDK, Soroban, Rust contracts |
| AI | MCP TypeScript SDK |
| Auth | Wallet-signature only (no email/password MVP) |
| Redis | **No** unless concrete need (§33, §44) |

*Note: `context.md` / landing lists Fastify in tech marquee — that’s display copy. Backend spec in `maincontext.md` is Express.*

---

## 5. Target monorepo (`maincontext.md` §43)

```
pay3/
├── apps/
│   ├── web/                    # Landing + dashboard (existing Next app moves here)
│   ├── api/                    # Express API
│   └── mcp-server/             # stdio MCP for Claude/Cursor
├── packages/
│   ├── database/               # Prisma
│   ├── shared/                 # Types, zod schemas
│   ├── auth/                   # Challenge/nonce, session cookies
│   ├── stellar/                # Horizon, tx build, simulate, submit
│   ├── session-manager/        # Create/revoke/expire AI sessions
│   ├── policy-engine/          # Off-chain: AUTO / APPROVAL / REJECT
│   ├── recipient-resolver/     # Contacts, aliases — never guess
│   └── transaction-engine/     # Lifecycle, idempotency, smart retry
├── contracts/
│   └── smart-account/          # Soroban Rust
└── docs/
    ├── IMPLEMENTATION_PLAN.md
    ├── ARCHITECTURE.md           # Week 1 — include §45 validation
    └── SECURITY.md             # Week 1 — map §36 principles
```

---

## 6. Build order (aligned with `maincontext.md`)

```
0. Foundation        monorepo, Neon, Prisma, ARCHITECTURE.md, SECURITY.md
1. Wallet auth       §10 — challenge/sign, no primary key stored
2. Dashboard shell   §7 — routes for all MVP screens (can be empty)
3. Smart account     §11–13 — link account, manual allocate funds (testnet)
4. Contacts          §23 — saved verified recipients (name → G-address)
5. AI sessions       §14–18 — create, encrypt keys §16, permission review §17
6. Policy engine     §20–22 — off-chain three-level model
7. Transaction engine §24, §27–29 — lifecycle, idempotency, smart retry (max 2)
8. MCP server        §30–31 — only after sessions exist
9. Approvals UI      §25–26 — 2-minute expiry
10. On-chain policy  §20 — Soroban enforces hard limits (parallel from step 3)
11. Dashboard polish §7 — monthly usage, audit logs
```

---

## 7. Phase breakdown

### Phase 0 — Foundation (Days 1–4)

| Deliverable | Spec ref |
|-------------|----------|
| Monorepo; `apps/web` = current landing | §43 |
| `apps/api` health + Express skeleton | §33 |
| Prisma + Neon | §34 |
| `docs/ARCHITECTURE.md` — wallet → smart account → session → MCP diagram | §8, §45 |
| `docs/SECURITY.md` — 18 rules from §36 | §36 |
| `.env.example` | — |

**Prisma v1 models** (extends §35):

```
User
Wallet                 (publicKey only)
SmartAccount             (contractId / address ref, allocated balance tracking)
Contact                  (name, stellarAddress, verified)
AiSession                (clientType, encryptedSessionKey, expiresAt, revokedAt, status)
Policy                   (preset or custom rules JSON)
Transaction              (full lifecycle §29)
ApprovalRequest          (2-min expiry §26)
IdempotencyRecord        (key → transactionId)
UsageRecord              (monthly aggregates §7)
AuditLog
```

---

### Phase 1 — Auth + dashboard shell (Week 1)

**Spec:** §10, §37 steps 2–5

| Task | Done when |
|------|-----------|
| Freighter connect in `apps/web` | Wallet address in UI |
| `POST /auth/challenge` → sign → `POST /auth/verify` | Session cookie; nonce single-use §10 |
| Protected `/dashboard/*` | Unauthenticated → connect flow |
| Empty pages: Overview, Sessions, Policies, History, Approvals, Settings | Nav matches §7 MVP list |

**Never store:** primary wallet private key (§9, §36 #1).

---

### Phase 2 — Smart account + funding (Week 2)

**Spec:** §11–13, §37 steps 6–7

| Task | Done when |
|------|-----------|
| `SmartAccount` DB + link flow after wallet auth | User sees smart account status |
| Manual fund UI: “Send X USDC to smart account address” | Testnet allocation works |
| `packages/stellar` read balances for **smart account** (not only G-wallet) | Dashboard overview shows allocated balance |
| Horizon tx history read | History tab reads real data |

**Parallel (chain):** Start Soroban spike per §45 — document what’s enforceable on-chain.

---

### Phase 3 — Contacts + recipient resolver (Week 2–3)

**Spec:** §23

| Task | Done when |
|------|-----------|
| `packages/recipient-resolver` | |
| CRUD contacts in dashboard | User saves “Hurain” → G-address |
| Resolve by name in engine | Unique match → address |
| Ambiguous / zero match | Returns error; **no payment** (§23) |

---

### Phase 4 — AI sessions + permission review (Week 3)

**Spec:** §14–18, §37 steps 8–11

| Task | Done when |
|------|-----------|
| Session create wizard: client, duration, budget, per-tx max, approval threshold, allowed actions | |
| **Permission review screen** (ALLOWED/BLOCKED list) | §17 |
| User **signs with wallet** to authorize session | §17 |
| `packages/session-manager` — independent session per client | §15 |
| Encrypted session key storage | §16 — never plaintext, never in API/logs/AI |
| Generate MCP credential (API key / token) for that session | §31 |
| Session expiry job | Expired = no further txs §18 |
| Revoke single session | §15 |

**Done when:** Two sessions (e.g. Claude + Cursor) with different policies; revoking one leaves the other active.

---

### Phase 5 — Policy engine (Week 3–4)

**Spec:** §20–22

| Task | Done when |
|------|-----------|
| Off-chain evaluator in `packages/policy-engine` | |
| Inputs: session, action, asset, amount, recipient, rate limits | §24 step 6 |
| Outputs: `AUTO_EXECUTE` \| `PENDING_APPROVAL` \| `REJECTED` | §22 |
| Optional presets: Conservative / Balanced / Custom | §21 (Custom required; presets nice-to-have) |
| Policy decision stored on every transaction | §24 step 15 |

On-chain enforcement (§20) lands in Phase 8 — off-chain runs first for velocity.

---

### Phase 6 — Transaction engine (Week 4)

**Spec:** §24, §27–29

| Task | Done when |
|------|-----------|
| States: CREATED → VALIDATING → AUTO_APPROVED \| PENDING_APPROVAL → SIGNING → SUBMITTING → SUCCESS \| FAILED \| REJECTED \| EXPIRED \| CANCELLED | §29 |
| Idempotency key on every MCP transfer request | §28 |
| Smart retry: max **2** additional attempts, technical failures only | §27 |
| Simulate before submit where appropriate | §24 step 9 |
| Sign with session key (backend only) | §24 step 10 |
| Record hash, session, policy decision, audit | §24 step 15 |

---

### Phase 7 — MCP server (Week 4–5)

**Spec:** §30–31, §37 steps 12–14

**Only start after Phase 4 complete.**

| Tool | Spec name | Priority |
|------|-----------|----------|
| `get_balance` | §30 | P0 |
| `transfer` | §30 | P0 |
| `get_transaction_history` | §30 | P1 |

| Task | Done when |
|------|-----------|
| `apps/mcp-server` stdio + MCP SDK | |
| Authenticate to specific AI session | §30 |
| `docs/MCP_SETUP.md` — manual `claude_desktop_config.json` | §31 |
| End-to-end: Claude → transfer → Hurain contact → testnet | §38 example |

---

### Phase 8 — Approvals + emergency controls (Week 5)

**Spec:** §19, §25–26, §32 #9–10

| Task | Done when |
|------|-----------|
| Dashboard pending approvals with approve/reject | §25 |
| **2-minute expiry** on pending approvals | §26 |
| `[ REVOKE ALL AI ACCESS ]` button | §19 |
| `get_transaction_history` MCP tool shipped | §32 #13 |

---

### Phase 9 — Soroban on-chain enforcement (Week 5–8, parallel from Week 2)

**Spec:** §11, §20, §24 step 11, §45

| Task | Done when |
|------|-----------|
| Validate wallet → smart account → session key model | §45 doc signed off |
| Rust contract: session validity, hard limits, revocation | §20 |
| Transaction path calls on-chain validation before submit | §24 step 11 |
| Backend cannot bypass critical limits if compromised | §36 #9, #18 |

---

### Phase 10 — Dashboard completion (Week 6)

**Spec:** §7, §32 #21

| Screen | Required |
|--------|----------|
| Wallet / smart account overview | ✅ |
| Monthly usage | ✅ |
| Transaction history | ✅ |
| Active AI sessions | ✅ |
| Policy management | ✅ |
| Pending approvals | ✅ |
| Emergency revoke all | ✅ |
| Audit log (read-only) | ✅ |

---

## 8. Full payment flow checklist (`maincontext.md` §24)

Use this to verify Phase 6–7:

- [ ] 1–3 User command → AI → MCP `transfer({ recipient, asset, amount })`
- [ ] 4 Session authentication (client, session, user, smart account, policy)
- [ ] 5 Recipient resolution (unique contact)
- [ ] 6 Off-chain policy validation (all checks in §24)
- [ ] 7 AUTO / PENDING / REJECT decision
- [ ] 8–9 Build + simulate transaction
- [ ] 10 Session-key authorization (encrypted, backend only)
- [ ] 11 On-chain Soroban validation (Phase 9)
- [ ] 12–13 Submit + confirm on Stellar
- [ ] 14 Structured result returned to AI
- [ ] 15 Full audit record persisted

---

## 9. Official MVP scope mapping (`maincontext.md` §32)

| # | MVP item | Phase |
|---|----------|-------|
| 1 | Connect existing Stellar wallet | 1 |
| 2 | Wallet-signature authentication | 1 |
| 3 | Soroban smart account | 2 + 9 |
| 4 | Limited fund allocation | 2 |
| 5 | AI session keys | 4 |
| 6 | Independent sessions per AI client | 4 |
| 7 | Explicit permission review | 4 |
| 8 | Session expiration + revocation | 4 |
| 9 | Emergency revoke-all | 8 |
| 10 | Hybrid policy engine | 5 + 9 |
| 11 | Three-level execution model | 5 |
| 12 | Pay3 MCP server | 7 |
| 13 | get_balance, transfer, get_transaction_history | 7–8 |
| 14 | Hybrid recipient resolution | 3 |
| 15 | Manual approval flow | 8 |
| 16 | Two-minute approval expiry | 8 |
| 17 | Smart retry | 6 |
| 18 | Idempotency protection | 6 |
| 19 | Transaction lifecycle tracking | 6 |
| 20 | Manual MCP configuration | 7 |
| 21 | Dashboard (all §7 screens) | 1 shell → 10 complete |

---

## 10. Security principles — implementation gate (`maincontext.md` §36)

Do not ship Phase 7 (MCP transfers) until these are true:

1. No primary private key in DB  
2. Session keys never exposed to AI / frontend / logs  
3. Independent sessions per assistant  
4. Every session expires  
5. Individual + revoke-all works  
6. Policy on every financial request  
7. Recipient never guessed  
8. Idempotency on every transfer  
9. Manual approval expires in 2 minutes  
10. AI funds isolated from main wallet (smart account boundary)

---

## 11. Future roadmap (do not build now)

| Phase | Scope | `maincontext.md` |
|-------|--------|------------------|
| 2 | DeFi: Blend, Phoenix, Aquarius | §39, §42 |
| 3 | Merchant / API / subscription payments | §40 |
| 4 | Procurement automation | §41 |
| 5 | Enterprise, org policies, agent identities | §42 |

---

## 12. Start now (this week)

1. [ ] Branch `feature/monorepo`
2. [ ] Move current app → `apps/web`; root workspaces
3. [ ] `apps/api` Express + `/health`
4. [ ] `packages/database` — Prisma schema from §9 above
5. [ ] `docs/ARCHITECTURE.md` — copy §8 diagram + §45 open questions
6. [ ] `docs/SECURITY.md` — copy §36 as checklist
7. [ ] `/dashboard` route + Freighter connect (no smart account yet)

**Do not start:** MCP server, DeFi tools, Redis, email auth, one-click MCP connect.

---

## 13. Weekly demos

| Week | Demo | Journey steps |
|------|------|----------------|
| 1 | Wallet → dashboard | §37 2–5 |
| 2 | Smart account funded on testnet | §37 6–7 |
| 3 | Session created + permission signed | §37 8–11 |
| 4 | Policy rejects over-limit transfer (API test) | §22 |
| 5 | Claude executes Hurain payment via MCP | §37 14–22 |
| 6 | Approval timeout + revoke all | §25–26, §19 |

---

## 14. Risks

| Risk | Mitigation |
|------|------------|
| §45 Soroban model unclear | Document week 1; off-chain policy + testnet custody unblocks MCP |
| Session key custody | Encrypt at rest §16; plan KMS path for production |
| Scope creep (DeFi) | §32 checklist is exit gate for Phase 2 |
| Landing vs product | `/` = marketing; `/dashboard` = app |

---

* v2 — Re-audited against full `maincontext.md` (49 sections). Previous plan corrected: session-before-MCP ordering, smart account earlier, permission review, recipient resolver, full tx lifecycle.*
