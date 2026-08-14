# Zipper (Protocol 27) Smart Account Plan

**Goal:** Pay3 `__check_auth` uses CAP-71 `get_delegated_signers` + `delegate_auth` so AI sessions are Zipper-native delegates.

**Architecture:** Session registered as G-`Address`. Auth entry uses `AddressWithDelegates`; contract signature void; session G signs as delegate. Policy caps still enforced in `__check_auth` before `delegate_auth`.

**Stack:** soroban-sdk 27, existing JS `@stellar/stellar-sdk` if it exposes WithDelegates (else document client gap).

**WASM (2026-07-19):** `842c28f0f4db756cfbe259553993fd1045c0df32966b4bebff9d94720490e5e0` → `artifacts/pay3_smart_account.wasm`

**Canary:** needs `CANARY_DEPLOYER_SECRET` + `CANARY_OWNER_G` in env (not in local `.env` yet). Then `npm run canary:deploy`.

---
    