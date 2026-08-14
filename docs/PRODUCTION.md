# Production — Stellar mainnet

Pay3 ships on **Stellar public mainnet**. Freighter must be set to **mainnet**. Only fund allocation pots with XLM you accept spending.

## Architecture

```
Vercel web — https://paythreewallet.vercel.app
  NEXT_PUBLIC_API_URL=/api
  NEXT_PUBLIC_STELLAR_NETWORK=Public Global Stellar Network ; September 2015
  API_PROXY_ORIGIN=https://pay3-api.vercel.app
        ↓ rewrites /api/*
Vercel API (bundled Express) — https://pay3-api.vercel.app
        ↓
Neon Postgres (DATABASE_URL + DIRECT_URL)
Horizon mainnet + Soroban RPC mainnet
```

Same-origin `/api` proxy keeps Freighter session cookies first-party.

Redeploy API: `node scripts/deploy-api-vercel.mjs` (set `SKIP_ENV_PUSH=1` after first env push).  
Push web env: `node scripts/vercel-push-web-env.mjs`

## Required env (API)

```env
NODE_ENV=production
PORT=4000
WEB_ORIGIN=https://paythreewallet.vercel.app
DATABASE_URL=...
DIRECT_URL=...
SMART_ACCOUNT_ENCRYPTION_KEY=<long-random-secret>
STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_RPC_URL=https://mainnet.sorobanrpc.com
SOROSWAP_NETWORK=mainnet
# SOROSWAP_API_KEY=...
# Optional: seed new jars via createAccount (otherwise user funds from Freighter)
# RELAYER_SECRET=S...
# MAINNET_JAR_SEED_XLM=2
```

## Required env (Web)

```env
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SITE_URL=https://paythreewallet.vercel.app
NEXT_PUBLIC_STELLAR_NETWORK=Public Global Stellar Network ; September 2015
API_PROXY_ORIGIN=https://pay3-api.vercel.app
```

## Linking a jar on mainnet

1. Connect Freighter (**mainnet**).
2. Link smart account → Pay3 creates a G-address.
3. **Friendbot is disabled.** Without `RELAYER_SECRET`, the jar is unfunded until you send XLM from Freighter (createAccount on first payment).
4. With `RELAYER_SECRET`, Pay3 can seed ~2 XLM via `createAccount` automatically.

## Cutover notes

- Old **testnet** allocation accounts will not work on mainnet Horizon — users must re-link / fund a new jar.
- Switch Freighter network to mainnet before signing.
- WalletConnect uses CAIP chain `stellar:pubnet`.
- Explorer links use `stellar.expert/explorer/public/...`.

Health: `GET https://pay3-api.vercel.app/health` → `{"ok":true,...}`
