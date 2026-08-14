export const NAV_LINKS = [
  { label: "Guide", href: "/guide", external: false },
  { label: "Features", href: "/#features", external: false },
  { label: "Docs", href: "https://pay3.mintlify.site", external: true },
  { label: "Official X", href: "https://x.com/PAYThreeWallet", external: true },
  { label: "Contact Us", href: "mailto:pay3wallet@gmail.com", external: true },
] as const;

export const TECH_STACK = [
  "Stellar",
  "Soroban",
  "MCP",
  "Next.js",
  "TypeScript",
  "Fastify",
  "PostgreSQL",
  "Prisma",
  "Redis",
  "Blend",
  "Phoenix",
  "Aquarius",
] as const;

export const STORY_SECTIONS = [
  {
    id: "mcp",
    eyebrow: "01 — The Bridge",
    title: "Give Your AI Financial Superpowers",
    body: "Pay3 exposes wallet, DeFi, and payment tools through an MCP server — so Claude, ChatGPT, Cursor, and Gemini can act on your behalf without ever touching your private key.",
    cta: "Explore MCP Tools",
    screen: "mcp" as const,
  },
  {
    id: "session-keys",
    eyebrow: "02 — Delegated Trust",
    title: "Permissions Without Private Keys",
    body: "Soroban session keys grant AI assistants temporary, scoped authority. Set duration, spend caps, daily budgets, and allowed protocols — then revoke anytime.",
    cta: "See Session Keys",
    screen: "policy" as const,
  },
  {
    id: "policy",
    eyebrow: "03 — Guardrails",
    title: "Every Transaction Passes the Policy Engine",
    body: "Daily budgets, per-tx limits, allowed smart contracts, blocked actions — nothing executes until every rule passes. The AI proposes; your policy decides.",
    cta: "Review Policies",
    screen: "policy-check" as const,
  },
  {
    id: "defi",
    eyebrow: "04 — DeFi Native",
    title: "Curated Protocols on Stellar",
    body: "Blend for lending, Phoenix for swaps, Aquarius for liquidity — your AI can supply, borrow, rebalance, and claim rewards across integrated protocols.",
    cta: "Explore Products",
    screen: "defi" as const,
  },
  {
    id: "payments",
    eyebrow: "05 — Real Commerce",
    title: "Autonomous Merchant Payments",
    body: "From restaurant supply orders to API subscriptions — AI validates policy, executes USDC transfers on Stellar, and settles in seconds with near-zero fees.",
    cta: "Explore Payments",
    screen: "payments" as const,
  },
  {
    id: "network",
    eyebrow: "06 — Agent Network",
    title: "Built for Multi-Agent Workflows",
    body: "Run Claude for payments, Cursor for development, custom agents for procurement — all connected to the same policy engine and Stellar wallet infrastructure.",
    cta: "Start Building",
    screen: "network" as const,
  },
] as const;

export const FLOW_STEPS = [
  { label: "You", sub: "Natural language command" },
  { label: "AI Assistant", sub: "Calls Pay3 MCP tool" },
  { label: "Policy Engine", sub: "Validates every rule" },
  { label: "Session Key", sub: "Scoped authorization" },
  { label: "Stellar", sub: "Transaction settles" },
] as const;

export const HOW_IT_WORKS = [
  {
    step: "01",
    badge: "Dashboard",
    title: "Connect Freighter and fund your allocation pot",
    description:
      "Sign in with Freighter on mainnet. Pay3 links a separate allocation account — only that pot is available to AI sessions.",
    screen: "config" as const,
  },
  {
    step: "02",
    title: "Authorize an AI session with spend limits",
    description:
      "Set duration, daily budget, per-tx max, and approval threshold. Review permissions, then sign with Freighter and copy the one-time MCP token.",
    screen: "policy-setup" as const,
  },
  {
    step: "03",
    title: "Connect Cursor and pay by name or address",
    description:
      "Add Pay3 to Cursor MCP. Ask for balance or “pay Hurain 0.5 XLM.” Policy checks every transfer; revoke anytime from the dashboard.",
    screen: "ready" as const,
  },
] as const;

export const FAQ_ITEMS = [
  {
    q: "What is Pay3?",
    a: "Pay3 lets an AI assistant send Stellar payments from a separate allocation pot you fund — under session limits you authorize in Freighter. Your primary wallet key never leaves Freighter.",
  },
  {
    q: "How does Pay3 work?",
    a: "Connect Freighter, fund the allocation account, save contacts, create an AI session, then connect Cursor with your MCP token. Natural-language commands call Pay3 tools; every transfer passes the policy engine before it settles on Stellar mainnet.",
  },
  {
    q: "What wallets are supported?",
    a: "Freighter for sign-in and session authorization on Stellar mainnet. Pay3 never stores your Freighter private key. AI spends use encrypted session material and the allocation pot only.",
  },
  {
    q: "What are the fees?",
    a: "Stellar network fees are typically fractions of a cent. Pay3 itself does not charge a product fee in this beta. Only fund the allocation pot with amounts you accept spending.",
  },
  {
    q: "Which AI assistants are supported?",
    a: "Cursor is the recommended client (local or hosted MCP). Claude Desktop can use the same stdio config. Browser claude.ai custom connectors need a hosted HTTPS MCP URL.",
  },
  {
    q: "Is DeFi / USDC live?",
    a: "Native XLM transfers are supported on mainnet. Swap quote/execute via Soroswap is available when pools exist and the session allows execute_swap. Broader DeFi UX is still expanding.",
  },
] as const;

export const EXAMPLE_COMMANDS = [
  '"What’s my Pay3 balance?"',
  '"Pay 0.5 XLM to Hurain."',
  '"Pay 0.5 XLM to Debjit."',
  '"Pay 0.5 XLM to Manas."',
  '"Show my recent Pay3 transactions."',
] as const;
