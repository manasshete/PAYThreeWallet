# Soroban setup — Phase 9c

Pay3’s contract lives in `contracts/smart-account/`. Build target is **`wasm32v1-none`**.

## 1. Tooling

```powershell
# Rust + WASM target
rustup target add wasm32v1-none
# Stellar CLI on PATH (e.g. %USERPROFILE%\.cargo\bin)
stellar version
```

## 2. Build + test

```powershell
cd contracts/smart-account
cargo test
stellar contract build
# Artifact: artifacts/pay3_smart_account.wasm (copy from CLI output if needed)
# Current Zipper build (2026-07-19): sha256 842c28f0f4db756cfbe259553993fd1045c0df32966b4bebff9d94720490e5e0 (8431 bytes)
```

Exported methods: `__constructor`, `__check_auth`, `add_session`, `revoke_session`, `get_session`, `owner`, `native_sac`.

**Auth:** Zipper (Protocol 27 / CAP-71) — `Signature = ()`, sessions are G-`Address` delegates via `get_delegated_signers` + `delegate_auth`.

Rebuild WASM after Zipper changes and refresh `PAY3_ALLOWED_WASM_HASHES` (include the hash above).

## Stellar reference (AI-friendly)

- Docs index for LLMs: https://developers.stellar.org/llms.txt
- Contract accounts: https://developers.stellar.org/docs/build/guides/contract-accounts.md
- Auth: https://developers.stellar.org/docs/build/guides/auth.md
- Raven (live Stellar docs MCP): https://raven.stellar.buzz/mcp

## 3. Contract surface (Zipper / Phase 9c+)

| Method | Who | Purpose |
|--------|-----|---------|
| `__constructor(owner, native_sac)` | deploy-time | Atomic init |
| `add_session(session: Address, …)` | owner `require_auth` | Register Zipper delegate |
| `revoke_session(session)` | owner | Kill session on-chain |
| `get_session(session)` | anyone | Read policy + spent |
| `__check_auth` | host | Caps then `delegate_auth` to owner/session |

Session delegates **cannot** authorize admin methods on the account contract.


## 4. Canary deploy (one opt-in account)

```powershell
# Fund deployer/funder on testnet first. Never commit secrets.
$env:CANARY_DEPLOYER_SECRET="S..."
$env:CANARY_OWNER_G="G..."
$env:CANARY_OWNER_SECRET="S..."   # or CANARY_OWNER_PK_HEX
$env:CANARY_FUNDER_SECRET="S..."  # optional; defaults to deployer
$env:STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
node scripts/canary-deploy.mjs
```

Then (authenticated API):

```http
POST /smart-account/enable-contract-custody
{ "confirm": "ENABLE_CONTRACT_CUSTODY", "contractRef": "C…", "wasmHash": "…", "contractVersion": "phase9c-v1", "deployTxHash": "…" }
```

Rollback (no delete / no automatic G sweep):

```http
POST /smart-account/rollback-legacy
{ "confirm": "ROLLBACK_LEGACY" }
```

Fund the C-account via **native SAC transfer** only — never Friendbot or Horizon `loadAccount(C…)`.

## 5. Runtime env

| Var | Purpose |
|-----|---------|
| `STELLAR_RPC_URL` | Soroban RPC |
| `NATIVE_SAC_CONTRACT_ID` | Optional override |
| `RELAYER_SECRET` | Backend fee-payer G secret (never to clients) |
| `STELLAR_HORIZON_URL` | Legacy G-account path |

## 6. Cutover status

- **Default for new users:** still **legacy** G-account (`custodyMode=legacy`)
- **Contract path:** opt-in canary only until security review + migration gate
- Off-chain policy, approvals, idempotency, and two-retry technical ceiling unchanged

See `docs/TECHNICAL_VALIDATION.md` and `docs/SECURITY.md`.
