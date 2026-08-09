"use client";

import { useId, useRef, type ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { useDialogBehavior } from "@/hooks/useDialogBehavior";

type ModalProps = {
  open: boolean;
  /** Called for every dismissal route — close button, backdrop, and Escape. */
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Pinned below the scroll area; the primary action belongs here. */
  footer?: ReactNode;
  /** Accessible name for the close button. */
  closeLabel?: string;
  children: ReactNode;
};

/**
 * Centered task modal.
 *
 * The Drawer next door is for reading a record; this is for editing one, which
 * wants a wider measure and a form that is not competing with the page behind
 * it. Full-bleed sheet below `sm` — a 640px card cannot fit a 360px phone — and
 * a centered card above it.
 *
 * Every exit routes through `onClose`, backdrop and Escape included, so an owner
 * holding unsaved work can intercept all of them in one place.
 *
 * The dialog contract (Escape, focus trap, focus restore, scroll lock) comes
 * from `useDialogBehavior`, shared with the Drawer and the mobile sidebar.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  footer,
  closeLabel = "Close dialog",
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const subtitleId = useId();

  useDialogBehavior({ open, onClose, panelRef, initialFocusRef: closeButtonRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[color:var(--overlay)] backdrop-blur-[3px]"
        style={{ animation: "ha-fade-in var(--duration) var(--ease)" }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        className="relative flex h-full w-full flex-col bg-[color:var(--card)] shadow-[var(--shadow-xl)] sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:max-w-[40rem] sm:rounded-[var(--radius-2xl)] sm:border sm:border-[color:var(--border)]"
        style={{ animation: "ha-menu-in 160ms var(--ease)" }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="ha-section-title text-[color:var(--foreground)]">
              {title}
            </h2>
            {subtitle ? (
              <p id={subtitleId} className="mt-0.5 text-[0.8125rem] leading-snug text-[color:var(--text-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="ha-btn ha-btn-ghost ha-btn-icon ha-btn-sm shrink-0"
          >
            <Icon name="x" size={15} />
          </button>
        </header>

        <div className="ha-scroll flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>

        {footer ? (
          <footer className="border-t border-[color:var(--border)] bg-[color:var(--card-2)] px-5 py-3.5 sm:rounded-b-[var(--radius-2xl)]">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
