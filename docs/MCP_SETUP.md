# Pay3 MCP Setup

Connect **Cursor** (or Claude Desktop) to Pay3.

## What works / what does not

| Client | Works? | How |
|--------|--------|-----|
| Cursor (hosted) | Yes | `.cursor/mcp.json` with `url` + Bearer token |
| Cursor / Claude Desktop (local stdio) | Yes | `node apps/mcp-server/dist/index.js` |
| claude.ai browser connector | Maybe | Needs HTTPS remote MCP — try hosted URL below |

## Hosted MCP (recommended)

No repo clone. Create a session on https://paythreewallet.vercel.app, copy the token, then:

```json
{
  "mcpServers": {
    "pay3": {
      "url": "https://pay3-api.vercel.app/mcp",
      "headers": {
        "Authorization": "Bearer pay3_PASTE_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

If Cursor shows **timeouts / “user-pay3 unhealthy”** on the hosted URL (common with Vercel cold starts), use **local stdio → prod API** instead (same token):

```json
{
  "mcpServers": {
    "pay3": {
      "command": "node",
      "args": ["${workspaceFolder}/apps/mcp-server/dist/index.js"],
      "env": {
        "PAY3_API_URL": "https://pay3-api.vercel.app",
        "PAY3_MCP_TOKEN": "pay3_PASTE_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Build once: `npm run build:mcp`. Then **Settings → Tools & MCP → reload pay3**. Disable any duplicate broken `user-pay3` entry that still points at the old hosted URL.
## Local stdio (developers)

1. API running: `npm run dev:api` (port 4000)
2. Smart account linked + funded (testnet XLM)
3. Active AI session + MCP token from dashboard (shown once)
4. Build once: `npm run build:mcp`

```powershell
$env:PAY3_MCP_TOKEN="pay3_YOUR_TOKEN_HERE"
npm run smoke:mcp
```

Preferred local Cursor config:

```json
{
  "mcpServers": {
    "pay3": {
      "command": "node",
      "args": ["C:/coding/PAy3-deb/apps/mcp-server/dist/index.js"],
      "env": {
        "PAY3_API_URL": "http://localhost:4000",
        "PAY3_MCP_TOKEN": "pay3_PASTE_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Then open **Cursor Settings → Tools & MCP** and enable **pay3**.

## Claude Desktop (local)

1. Install/open Claude Desktop so `%APPDATA%\Claude` exists.
2. Create/edit `%APPDATA%\Claude\claude_desktop_config.json` with the local stdio JSON above (or hosted `url` form if the client supports it).
3. Fully quit Claude Desktop and reopen.

## Notes

- Token is shown **once** at session create; only a hash is stored.
- Revoke in the dashboard to kill the token immediately.
- REST paths `/mcp/balance`, `/mcp/transfer`, `/mcp/history`, `/mcp/swap-quote` remain for the local stdio server.
- Tools: `get_balance`, `transfer`, `get_transaction_history`, `get_swap_quote`, `execute_swap` (opt-in).
- `get_swap_quote` is **read-only** (Soroswap aggregator across Soroswap/Phoenix/Aqua).
- `execute_swap` runs quote→build→sign→send. **Not** in default session allowlist — enable “Allow DeFi swap execute” when creating a session. Requires `SOROSWAP_API_KEY`, matching `SOROSWAP_NETWORK` + Stellar network, and legacy G allocation (not contract custody yet). Financial failures (slippage, underfunded) are never auto-retried.
