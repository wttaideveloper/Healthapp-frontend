"use client";

import { createPortal } from "react-dom";

type WorkspaceActionsMenuProps = {
  anchorRect: DOMRect | null;
  isActive: boolean;
  onRequestClose: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
};

export function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="4.5" r="1.6" fill="currentColor" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" />
      <circle cx="10" cy="15.5" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function WorkspaceActionsMenu(props: WorkspaceActionsMenuProps) {
  if (!props.anchorRect) return null;

  const menuWidth = 224;
  const estimatedMenuHeight = 120;
  const margin = 10;

  const placeAbove = props.anchorRect.bottom + 8 + estimatedMenuHeight > window.innerHeight - margin;
  const top = placeAbove ? props.anchorRect.top - 8 : props.anchorRect.bottom + 8;
  const left = Math.min(Math.max(props.anchorRect.right, menuWidth + margin), window.innerWidth - margin);
  const transform = placeAbove ? "translate(-100%, -100%)" : "translate(-100%, 0)";

  return createPortal(
    <div
      data-workspace-menu-root
      role="menu"
      style={{ position: "fixed", top, left, transform }}
      className="z-50 w-56 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="p-1">
        <button
          role="menuitem"
          type="button"
          onClick={() => {
            props.onToggleActive();
            props.onRequestClose();
          }}
          className="w-full rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-muted"
        >
          {props.isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          role="menuitem"
          type="button"
          onClick={() => {
            props.onDelete();
            props.onRequestClose();
          }}
          className="w-full rounded-xl px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
        >
          Delete
        </button>
      </div>
    </div>,
    document.body,
  );
}
