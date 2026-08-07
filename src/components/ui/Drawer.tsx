"use client";

import { useRef, type ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { useDialogBehavior } from "@/hooks/useDialogBehavior";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Rendered under the title in the header. */
  subtitle?: string;
  /** Optional status chip or badge shown beside the title. */
  eyebrow?: ReactNode;
  /** Pinned to the bottom of the drawer, outside the scroll area. */
  footer?: ReactNode;
  /** `md` suits property lists; `lg` suits drawers with tables inside. */
  size?: "md" | "lg";
  children: ReactNode;
};

/**
 * Right-side detail panel.
 *
 * Responsive by design: a full-height sheet on phones (a 448px panel on a 360px
 * screen would be a horizontal scroll), and an inset, rounded, floating panel
 * from `sm` up so it reads as a layer above the page rather than a second page.
 *
 * The dialog contract (Escape, focus trap, focus restore, scroll lock) comes
 * from `useDialogBehavior`, shared with the mobile sidebar.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  footer,
  size = "md",
  children,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useDialogBehavior({ open, onClose, panelRef, initialFocusRef: closeButtonRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end sm:p-3">
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
        aria-label={title}
        className={`ha-scroll relative flex h-full w-full flex-col border-[color:var(--border)] bg-[color:var(--card)] shadow-[var(--shadow-xl)] sm:rounded-[var(--radius-2xl)] sm:border ${
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md"
        }`}
        style={{ animation: "ha-slide-in var(--duration-slow) var(--ease-out)" }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            {eyebrow ? <div className="mb-1.5 flex flex-wrap items-center gap-1.5">{eyebrow}</div> : null}
            <h2 className="truncate text-[color:var(--foreground)] ha-section-title">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 truncate text-[0.8125rem] text-[color:var(--text-muted)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close panel"
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
