# Swap Execute Implementation Plan

> **For Claude:** Implement task-by-task; keep MVP legacy-G only.

**Goal:** Opt-in MCP `execute_swap` — quote → build → sign → send via Soroswap (no default allowlist).

**Architecture:** Mirror `executeTransfer` lifecycle. Store `asset_out` in `transaction.recipient`. Policy uses same amount/budget/approval rules on `asset_in`. Contract custody swaps deferred.

**Tech Stack:** Express API, Soroswap REST, `@stellar/stellar-sdk` sign, Prisma transactions.

---
