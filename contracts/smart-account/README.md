# Pay3 Smart Account (Soroban) — Zipper / Phase 9c+

> Validation: [`docs/TECHNICAL_VALIDATION.md`](../../docs/TECHNICAL_VALIDATION.md)  
> Build/install: [`docs/SOROBAN_SETUP.md`](../../docs/SOROBAN_SETUP.md)

## Status

| Item | Status |
|------|--------|
| Zipper CAP-71 `__check_auth` (`delegate_auth`) | ✅ soroban-sdk 27 |
| Session = G-`Address` delegate + spend caps | ✅ |
| Rust tests (9 Zipper auth tests) | ✅ |
| Deploy ctor `(owner, native_sac)` | ✅ |
| JS `add_session(Address)` + canary deploy | ✅ |
| stellar-sdk 16 `buildWithDelegatesEntry` | declared; run root `npm install` |
| Default for new users | ❌ still legacy G-account |
| Broad migration / mainnet | ❌ deferred |

## Build

```bash
cd contracts/smart-account
cargo test
stellar contract build
```

## Canary

See `docs/SOROBAN_SETUP.md` and `scripts/canary-deploy.mjs`.
