-- Phase 9c: custody mode + on-chain session lifecycle
-- Reviewed migration (do not use db push for production).

ALTER TABLE "SmartAccount"
  ADD COLUMN IF NOT EXISTS "custodyMode" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS "contractVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "contractNetwork" TEXT,
  ADD COLUMN IF NOT EXISTS "wasmHash" TEXT,
  ADD COLUMN IF NOT EXISTS "deployTxHash" TEXT;

ALTER TABLE "AiSession"
  ADD COLUMN IF NOT EXISTS "expiresLedger" INTEGER,
  ADD COLUMN IF NOT EXISTS "onchainRegisterTxHash" TEXT,
  ADD COLUMN IF NOT EXISTS "onchainRevokeTxHash" TEXT,
  ADD COLUMN IF NOT EXISTS "policyVersion" TEXT;
