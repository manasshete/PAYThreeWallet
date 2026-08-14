import { MAX_TECHNICAL_RETRIES } from "@pay3/shared";

export type TxStatus =
  | "CREATED"
  | "VALIDATING"
  | "AUTO_APPROVED"
  | "PENDING_APPROVAL"
  | "SIGNING"
  | "SUBMITTING"
  | "SUCCESS"
  | "FAILED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export function canRetrySubmit(retryCount: number): boolean {
  // retryCount is attempts already done after first try; max 2 additional
  return retryCount < MAX_TECHNICAL_RETRIES;
}

export function nextRetryCount(retryCount: number): number {
  return retryCount + 1;
}

/** Self-check for retry ceiling. */
export function transactionEngineSelfCheck(): void {
  if (canRetrySubmit(0) !== true) throw new Error("retry 0 should allow");
  if (canRetrySubmit(1) !== true) throw new Error("retry 1 should allow");
  if (canRetrySubmit(2) !== false) throw new Error("retry 2 should stop");
  if (MAX_TECHNICAL_RETRIES !== 2) throw new Error("max retries must be 2");
}
