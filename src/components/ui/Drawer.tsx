"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Rendered under the title in the header. */
  subtitle?: string;
  /** Pinned to the bottom of the drawer, outside the scroll area. */
  footer?: ReactNode;
  children: ReactNode;
};

/**
 * Right-side drawer.
 *
 * Implements the dialog interaction contract by hand (no dependency):
 * Escape to close, click-outside to close, focus moved in on open and
 * restored on close, Tab cycling trapped inside, and background scroll locked.
 */
export function Drawer({ open, onClose, title, subtitle, footer, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;

      // A nested alert dialog owns both Escape and focus while it is open.
      // Listeners on `document` fire in registration order, so the drawer must
      // defer explicitly rather than rely on stopPropagation.
      if (document.querySelector('[role="alertdialog"]')) return;

      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [open, onClose],
  );

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Defer so the panel is mounted and the transition has started.
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 40);
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(15,23,42,0.35)] backdrop-blur-[2px]"
        style={{ animation: "ha-fade-in 160ms var(--ease)" }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ha-scroll relative flex h-full w-full max-w-md flex-col border-l border-[color:var(--border)] bg-[color:var(--card)] shadow-[var(--shadow-lg)]"
        style={{ animation: "ha-slide-in 200ms var(--ease)" }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[0.9375rem] font-semibold tracking-[-0.01em]">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[0.8125rem] text-[color:var(--text-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="ha-btn ha-btn-ghost ha-btn-sm shrink-0"
          >
            <Icon name="x" size={15} />
          </button>
        </header>

        <div className="ha-scroll flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <footer className="border-t border-[color:var(--border)] bg-[color:var(--card-2)] px-5 py-3.5">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
}
