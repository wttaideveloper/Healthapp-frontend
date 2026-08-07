"use client";

import { useCallback, useEffect, type RefObject } from "react";

/**
 * The interaction contract every overlay in this product must honour.
 *
 * Escape closes · focus moves in on open and is restored on close · Tab cycles
 * inside the panel · background scroll is locked.
 *
 * Extracted so the right-side Drawer and the mobile sidebar cannot drift apart:
 * both are modal surfaces and both must behave identically for a keyboard user.
 */

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type DialogBehaviorOptions = {
  open: boolean;
  onClose: () => void;
  /** The modal panel. Focus is trapped inside it. */
  panelRef: RefObject<HTMLElement | null>;
  /** Receives focus on open. Falls back to the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

export function useDialogBehavior({ open, onClose, panelRef, initialFocusRef }: DialogBehaviorOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;

      // A nested alert dialog owns both Escape and focus while it is open.
      // Listeners on `document` fire in registration order, so this must defer
      // explicitly rather than rely on stopPropagation.
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
    [open, onClose, panelRef],
  );

  useEffect(() => {
    if (!open) return;

    const restoreFocusTo = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Defer so the panel is mounted and its entrance transition has started.
    const focusTimer = window.setTimeout(() => {
      const target =
        initialFocusRef?.current ??
        panelRef.current?.querySelector<HTMLElement>(focusableSelector) ??
        null;
      target?.focus();
    }, 40);

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo?.focus?.();
    };
  }, [open, handleKeyDown, panelRef, initialFocusRef]);
}
