# Technical Validation — Soroban Smart Account (§45)

> **Status:** Phase 9c+ **Zipper (Protocol 27 / CAP-71)** auth on the canary contract.  
> **Rule:** Contract custody remains **opt-in canary only** until security review + migration gate. Default new users remain legacy G-account.  
> **Spec source:** `maincontext.md` §11, §20, §45; [Zipper upgrade guide](https://stellar.org/blog/foundation-news/stellar-zipper-protocol-27-upgrade-guide).

---

## 1. Product model (unchanged)

```
Freighter G-wallet (owner)     ← never stored by Pay3
        ↓ owns / controls
Soroban smart account (C…)     ← holds allocated funds
        ↓ Zipper delegate_auth
AI session G-address (backend key)  ← CAP-71 delegated signer
        ↓
Off-chain policy → on-chain __check_auth (caps) → delegate_auth → Stellar
```

Interim MVP (live today): **encrypted G-address allocation account**. That remains valid until a Zipper-built WASM is deployed and funded.

---

## 2. Protocol findings (validated against current Soroban docs)

| Assumption | Verdict | Source |
|------------|---------|--------|
| Smart accounts can be **contract accounts** implementing custom auth | ✅ Supported | [Soroban Authorization](https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization) |
| Host calls `__check_auth` when `require_auth` hits the contract `Address` | ✅ Supported | Same + complex-account example |
| **Zipper CAP-71** `get_delegated_signers` + `delegate_auth` | ✅ Used in Pay3 `__check_auth` | Protocol 27 / soroban-sdk 27 |
| Session keys + spend limits belong **inside** `__check_auth` / policies | ✅ Fits product | Caps before `delegate_auth` |
| Production-ready smart-account frameworks exist | ✅ Prefer reuse later | OpenZeppelin accounts |
| Freighter “owns” contract like a classic account out of the box | ⚠️ Partial | Owner is an `Address` (G or C) |
| JS SDK for `AddressWithDelegates` | ⚠️ Needs `@stellar/stellar-sdk` **16+** | [P27 auth migration](https://stellar.github.io/js-stellar-sdk/guides/00-protocol-27-soroban-auth/) |
| Native USDC in contract balance | ⚠️ Separate | MVP stays **XLM** |

**Conclusion:** Pay3 canary contract is **Zipper-native** (delegated session G + policy caps). Client signing must use SDK 16 `buildWithDelegatesEntry` / `authorizeEntry(..., forAddress)` on Protocol 27 networks.

---

## 3. Decisions for Pay3 Phase 9

### D1 — Custody migration
1. Keep interim G-account until Zipper WASM is deployed on **testnet**.  
2. `SmartAccount.contractRef` ← contract id (`C…`).  
3. User funds contract (manual, same as today).  
4. Stop using `encryptedSecret` for new spends once contract path is default.

### D2 — What on-chain must enforce (non-bypassable)
- Exactly one Zipper delegated signer (owner or registered session `Address`)  
- Session validity + expiration + revocation  
- Hard per-tx / lifetime spend caps  
- Allowed invocation targets: native SAC `transfer` only (`from` = this contract)  
- Cryptographic check via **`delegate_auth`** (host verifies delegate), not custom AccSignature

### D3 — What stays off-chain
Recipient resolution, approval UX, MCP auth, risk heuristics — API / policy engine.

### D4 — Implementation approach (ordered)
1. ✅ Harden contract + Zipper `__check_auth` + Rust tests (sdk 27).  
2. ⬜ Bump JS to stellar-sdk 16 + `buildWithDelegatesEntry` on canary path (declared in `@pay3/stellar`; run `npm install` at root).  
3. ✅ Dual-run: off-chain policy still required; on-chain caps + Zipper are the hard gate.  
4. ⬜ Wider cutover only after security review + canary soak.

### D5 — Canary / rollback
- Enable via `POST /smart-account/enable-contract-custody` (explicit confirm).  
- Rollback via `POST /smart-account/rollback-legacy`.  
- Relayer G pays fees only; session key signs **as Zipper delegate** in backend memory.

---

## 4. Open items (block default cutover)

1. Security review before making contract custody default.  
2. Redeploy WASM after Zipper refactor; update `PAY3_ALLOWED_WASM_HASHES`.  
3. Finish monorepo `@stellar/stellar-sdk` 16 install if lockfile still on 14.  
4. Testnet USDC SAC path.  
5. Formal threat model (compromised API + session key vs on-chain caps).

---

## 5. Scaffold location

See [`contracts/smart-account/`](../contracts/smart-account/) and [`docs/SOROBAN_SETUP.md`](./SOROBAN_SETUP.md).  
Build target: **`wasm32v1-none`**. SDK: **soroban-sdk 27.0.0**.
