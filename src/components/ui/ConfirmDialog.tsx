"use client";

import { useEffect, useRef } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  /** Extra emphasis for irreversible actions. */
  warning?: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: IconName;
  tone?: "primary" | "danger";
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  warning,
  confirmLabel,
  cancelLabel = "Cancel",
  icon = "alert",
  tone = "primary",
  isBusy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Read from a ref so a parent re-render — a toast expiring, say — cannot
  // re-run the effect below, whose cleanup hands focus back to the caller.
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  });

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => confirmRef.current?.focus(), 30);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancelRef.current();
      }
    }

    // Capture phase so this closes before any parent drawer handler runs.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown, true);
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        aria-hidden="true"
        onClick={onCancel}
        className="absolute inset-0 bg-[rgba(15,23,42,0.4)]"
        style={{ animation: "ha-fade-in 140ms var(--ease)" }}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="ha-card relative w-full max-w-md p-5 shadow-[var(--shadow-lg)]"
        style={{ animation: "ha-menu-in 160ms var(--ease)" }}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={
              tone === "danger"
                ? { background: "var(--danger-soft)", color: "var(--danger)" }
                : { background: "var(--warning-soft)", color: "var(--warning)" }
            }
          >
            <Icon name={icon} size={17} />
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
              {title}
            </h2>
            <p id="confirm-description" className="mt-1.5 text-[0.8125rem] leading-relaxed text-[color:var(--text-muted)]">
              {description}
            </p>
            {warning ? (
              <p className="mt-2.5 rounded-lg bg-[color:var(--warning-soft)] px-3 py-2 text-xs leading-relaxed text-[color:var(--warning)]">
                {warning}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={isBusy} className="ha-btn ha-btn-secondary">
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`ha-btn ${tone === "danger" ? "ha-btn-danger" : "ha-btn-primary"}`}
          >
            {isBusy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
