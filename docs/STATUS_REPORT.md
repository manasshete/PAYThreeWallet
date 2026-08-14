# Pay3 — Plain-English Status Report

<div align="center">

<img src="assets/pay3-banner.png" alt="Pay3 — Delegate. Validate. Execute." width="100%" />

<p><a href="https://pay3.mintlify.site">Docs — pay3.mintlify.site</a> · <a href="https://x.com/PAYThreeWallet">X @PAYThreeWallet</a></p>

</div>

> Full kid-friendly overview of the whole product: [`WHAT_IS_PAY3.md`](./WHAT_IS_PAY3.md).

**Date:** 11 Jul 2026 — **Public Stellar testnet beta**  
**Audience:** You (founder / builder) — not engineers only  
**Goal of this doc:** Explain *what* we built, *why*, and *where you are* without jargon overload.

---

## 1. What is Pay3 (in one sentence)?

Pay3 lets someone say to an AI like Claude: *“Pay 5 USDC to Hurain”* — and money moves on Stellar **safely**, without giving the AI your main wallet keys.

We are **not** building “another chat wallet.”  
We are building the **security layer between AI and money**.

---

## 2. Why all this complexity?

If you give an AI your private key, it can drain everything. That’s unacceptable.

So Pay3’s design is:

```
Your main Freighter wallet  →  keeps most of your money
         ↓ (you choose to send a little)
A separate “AI money pot”   →  only this pot can be used by AI
         ↓
Rules + approvals           →  AI can only do what you allowed
         ↓
Claude / Cursor via MCP     →  AI asks Pay3; Pay3 decides & executes
```

Phases 0–7 are live on testnet XLM (interim G-account, not Soroban yet). MCP `transfer` to a saved contact has been proven end-to-end.

---

## 3. What exists on your computer right now?

Think of the repo as **three apps + a database**:

| Piece | What it is | URL / place |
|-------|------------|-------------|
| **Landing page** | Marketing site (the pretty Pay3 homepage) | https://paythreewallet.vercel.app |
| **Dashboard** | Your control panel after login | https://paythreewallet.vercel.app/dashboard |
| **API** | Backend brain (auth, accounts, balances) | https://pay3-api.vercel.app |
| **Neon database** | Cloud Postgres — remembers users & accounts | Neon (internet) |

You run **two terminals**:

1. `npm run dev` → website  
2. `npm run dev:api` → backend  

Without the API, Connect Wallet / Link smart account will fail.

---

## 4. What you can do today (user journey so far)

### Step A — Visit the site
Open the landing page. This is marketing only.

### Step B — Connect Freighter (or phone QR)
Go to **Dashboard** → **Connect Freighter**, or **Scan with phone** to open `/login/qr/…` on mobile (Freighter / WalletConnect). Desktop polls and claims the session cookies.

**What happens:**

1. Freighter gives Pay3 your **public** address (safe to share).  
2. Pay3 asks you to **sign a short message** (not a payment).  
3. Backend checks the signature → you’re logged in.  
4. Your user row is saved in **Neon**.

**Why:** Prove “this wallet is yours” without ever taking your private key.

### Step C — Link smart account
On Overview, click **Link smart account**.

**What happens:**

1. Pay3 creates a **new Stellar testnet address** (a separate money pot).  
2. Friendbot gives it a tiny bit of test XLM so the account exists on-chain.  
3. The **secret key** for that pot is **encrypted** and stored in Neon.  
4. The browser only ever sees the **public address** (+ QR).

**Why:** AI (later) should spend from this pot, not from your main Freighter balance.

> **Important honesty:** This is an *interim* design. The final product wants a **Soroban smart contract** account. We haven’t built that contract yet. For now we use a normal Stellar account as a stand-in so we can keep building the product.

### Step D — Fund it (optional)
Copy address or scan **QR** → send testnet XLM from Freighter → **Refresh balances**.

**Why:** Only money you put in this pot can later be used by AI.

### Step E — History
**History** tab shows on-chain payments for that pot (from Stellar’s Horizon API).

---

## 5. What is *not* working yet (and that’s OK)

| Feature | Status | Why not yet |
|---------|--------|-------------|
| Claude / Cursor paying someone (testnet XLM) | ✅ | Proven via MCP `transfer` + contact resolve |
| Contacts (“debu” / Hurain → address) | ✅ | Dashboard Contacts + resolver |
| Policy engine (auto / approve / reject) | ✅ | Off-chain three-level engine |
| Real Soroban smart contract | ❌ | Phase 9 — interim G-account for now |
| Mainnet / USDC | ❌ | Still **testnet XLM** |

What’s left for product polish: Phase 8 (approvals UX / emergency controls) and Phase 9 (on-chain Soroban limits).

---

## 6. Why we did things in this order

From the product spec (`maincontext.md`):

1. Landing → people understand the product  
2. Wallet login → identity without passwords  
3. Separate money pot → safety boundary  
4. Contacts → don’t guess who “Hurain” is  
5. AI sessions + permission screen → you approve what AI can do  
6. Policy + transaction engine → safe execution  
7. MCP → Claude can call Pay3  

**We skipped ahead to MCP earlier in planning, then corrected:** sessions must come **before** MCP, or AI would have nothing safe to attach to.

---

## 7. Folder map (only what matters)

```
pay3-deb/
├── apps/web/          Website + dashboard (what you see)
├── apps/api/          Backend (auth, smart account, history)
├── packages/database/ Database schema (Prisma → Neon)
├── packages/stellar/  Talks to Stellar testnet
├── packages/shared/   Shared types
├── docs/              Plans & this report
├── maincontext.md     Full product bible (long)
└── context.md         Short marketing copy
```

---

## 8. Common confusion → clear answers

**“Why Neon / database?”**  
So when you refresh or restart the API, your user + smart account still exist.

**“Why Freighter?”**  
It’s a Stellar browser wallet. Pay3 doesn’t invent a new login; you prove ownership with a signature.

**“Why QR code?”**  
So you (or a phone wallet) can fund the pot by scanning instead of only copying the address. It’s for **funding your pot**, not for “anyone pays Pay3 as a merchant” yet.

**“Why do I see errors like api/ext/404?”**  
Those are usually from the **Freighter extension**, not from Pay3. Ignore them unless `/auth` or `/smart-account` fails.

**“Why testnet?”**  
So we can break things without losing real money.

**“What does Overview ‘pending’ / ‘linked’ mean?”**  
- **pending** = user exists, pot not created yet  
- **linked** = pot address created and ready to fund  

---

## 9. Progress scorecard

| Phase | Name | Status |
|-------|------|--------|
| 0 | Foundation (monorepo, API, Neon, docs) | ✅ Done |
| 1 | Wallet auth + dashboard shell | ✅ Done |
| 2 | Smart account + fund + QR + history | ✅ Done (interim G-account) |
| 3 | Contacts (“Hurain”) | ✅ Done |
| 4 | AI sessions + permission review | ✅ Done |
| 5 | Policy engine | ✅ Done |
| 6 | Transaction engine | ✅ Done |
| 7 | MCP (Claude / Cursor) | ✅ Done — see `docs/MCP_SETUP.md` |
| 8 | Approvals + emergency revoke | ✅ Done |
| 10 | Dashboard completion (audit + usage) | ✅ Done |
| 9 | Soroban technical validation + scaffold | ✅ |
| 9b | Contract source + local WASM build | ✅ Built (`artifacts/pay3_smart_account.wasm`) |
| 9c | Harden + RPC/relayer + canary wiring | ✅ Code complete — opt-in canary; default still legacy |

**Roughly:** Off-chain MVP complete + Phase 9c Soroban path wired for one opt-in canary. Public testnet beta still defaults to interim G-account. See `docs/SOROBAN_SETUP.md`.

---

## 10. What you should do next (simple)

1. Apply Prisma migration `20260717120000_phase9c_custody_onchain`.  
2. Set `STELLAR_RPC_URL` + `RELAYER_SECRET`; run `node scripts/canary-deploy.mjs` for one account.  
3. Security review before making contract custody the default.  

---

## 11. Bottom line

**What’s happening:** Pay3 testnet beta — Freighter → pot → contacts → session → policy → MCP pay → approvals / revoke / audit; Soroban canary available opt-in.

**Why it’s happening this way:** Security first — separate pot, encrypted session material, off-chain policy; on-chain `__check_auth` for canary accounts.

**Where you are:** Product is launchable as a **testnet beta**. Not mainnet. Contract custody not default yet.

If one sentence for a teammate:  
> *“Testnet beta: MCP payments on legacy G-accounts; Phase 9c Soroban canary ready for one opt-in account.”*
