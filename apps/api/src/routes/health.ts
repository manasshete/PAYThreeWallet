import { Router } from "express";
import type { ApiHealth } from "@pay3/shared";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  const payload: ApiHealth = {
    ok: true,
    service: "pay3-api",
    timestamp: new Date().toISOString(),
  };
  res.json(payload);
});
