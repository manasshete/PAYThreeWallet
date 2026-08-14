import "./env.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { authQrRouter } from "./routes/auth-qr.js";
import { healthRouter } from "./routes/health.js";
import { historyRouter } from "./routes/history.js";
import { contactsRouter } from "./routes/contacts.js";
import { policyRouter } from "./routes/policy.js";
import { sessionsRouter } from "./routes/sessions.js";
import { smartAccountRouter } from "./routes/smart-account.js";
import { transactionsRouter } from "./routes/transactions.js";
import { approvalsRouter } from "./routes/approvals.js";
import { mcpRouter } from "./routes/mcp.js";
import { auditRouter, usageRouter } from "./routes/audit.js";
import { demoX402Router } from "./routes/demo-x402.js";
import { handleMcpHttp } from "./mcp-http.js";

export function createApp() {
  const app = express();
  const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

  app.use(
    cors({
      // ponytail: hosted MCP clients (Cursor/Claude) may omit Origin or use other hosts;
      // tools stay Bearer-gated. Tighten allowlist if abuse appears.
      origin: (origin, cb) => {
        if (!origin || origin === webOrigin) {
          cb(null, true);
          return;
        }
        cb(null, true);
      },
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "Mcp-Session-Id", "Last-Event-ID"],
      exposedHeaders: ["Mcp-Session-Id"],
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use(healthRouter);
  app.use("/auth", authRouter);
  app.use("/auth", authQrRouter);
  app.use("/smart-account", smartAccountRouter);
  app.use("/history", historyRouter);
  app.use("/contacts", contactsRouter);
  app.use("/sessions", sessionsRouter);
  app.use("/policy", policyRouter);
  app.use("/transactions", transactionsRouter);
  app.use("/approvals", approvalsRouter);
  app.use("/audit", auditRouter);
  app.use("/usage", usageRouter);
  app.use("/demo/x402", demoX402Router);
  // Exact /mcp = Streamable HTTP protocol; /mcp/* = REST used by local stdio MCP
  app.all("/mcp", (req, res) => {
    void handleMcpHttp(req, res);
  });
  app.use("/mcp", mcpRouter);

  return app;
}
