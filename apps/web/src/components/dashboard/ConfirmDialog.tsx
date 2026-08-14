"use client";

import { useEffect } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        className="relative w-full max-w-sm overflow-hidden rounded-[1.25rem] border border-white/[0.1] bg-[#0e0e10] shadow-[0_24px_64px_rgba(0,0,0,0.65)]"
      >
        <div className="connect-flow-grid pointer-events-none absolute inset-0 opacity-[0.22]" aria-hidden />
        <div className="relative border-b border-white/[0.07] px-5 py-3">
          <p className="font-[family-name:var(--font-jetbrains-mono)] text-[8px] uppercase tracking-[0.18em] text-white/30">
            Confirm action
          </p>
        </div>
        <div className="relative px-5 py-4">
          <h2
            id="confirm-dialog-title"
            className="font-[family-name:var(--font-space-grotesk)] text-[17px] font-semibold tracking-[-0.02em] text-white/92"
          >
            {title}
          </h2>
          <p
            id="confirm-dialog-body"
            className="mt-2 text-[13px] leading-relaxed text-white/42"
          >
            {body}
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-white/12 px-4 py-2.5 text-[12px] text-white/60 transition-colors hover:border-white/22 hover:text-white/85"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`rounded-full px-4 py-2.5 text-[12px] font-semibold transition-opacity hover:opacity-90 ${
                destructive
                  ? "bg-rose-500/90 text-white hover:bg-rose-500"
                  : "bg-white text-black"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
