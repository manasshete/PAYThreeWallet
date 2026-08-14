# Pay3 Security Checklist

From `maincontext.md` §36. Gate MCP transfers on these.

- [x] Never store user's primary private key
- [x] Never expose session private keys to AI models
- [x] Never expose session private keys to frontend
- [x] Never log private signing material
- [x] Every AI assistant gets an independent session
- [x] Every session must expire
- [x] Every session individually revocable
- [x] Users can revoke all AI access
- [x] Critical limits enforced on-chain (Phase 9c canary — opt-in)
- [x] Every financial request passes policy validation
- [x] Ambiguous recipients never guessed
- [x] Idempotency on every transfer
- [x] Technical failures may retry (max 2); policy/auth failures do not
- [x] Manual approvals expire after 2 minutes
- [x] Main wallet funds isolated from allocated AI funds
- [x] AI permissions explicitly reviewed before authorization
- [x] Backend cannot bypass user asset boundaries

## Current implementation notes

- Auth uses one-time nonce challenges; primary key stays in Freighter
- Session cookies are httpOnly; no wallet secrets in localStorage
- Session secrets: AES-GCM at rest; decrypted only in backend memory for contract auth entries
- Relayer secret: backend-only fee payer; never returned in API responses
- Contract custody is opt-in canary; default remains legacy G-account until security review
- Rollback flips `custodyMode` to legacy without deleting G or C records; no automatic sweep

## Phase 9c release gate

Before making contract custody the **default** for new users:

1. Run contract tests + `stellar contract build`
2. Run `npm run smoke:stellar` and API/web builds
3. Canary soak on one opt-in testnet account
4. Explicit security review of custody branch + session on-chain flow
