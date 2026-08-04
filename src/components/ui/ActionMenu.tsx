"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";

export type ActionMenuItem = {
  key: string;
  label: string;
  icon?: IconName;
  onSelect: () => void;
  disabled?: boolean;
  /** Renders in the danger tone for destructive or irreversible actions. */
  destructive?: boolean;
  /** Shown as a muted second line — use it to explain a disabled item. */
  hint?: string;
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  /** Accessible name for the trigger, e.g. "Actions for Jane Doe". */
  label: string;
  align?: "left" | "right";
};

export function ActionMenu({ items, label, align = "right" }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const enabledIndexes = items.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onWindowChange() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onWindowChange);
    window.addEventListener("scroll", onWindowChange, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onWindowChange);
      window.removeEventListener("scroll", onWindowChange, true);
    };
  }, [open]);

  useEffect(() => {
    if (open && activeIndex >= 0) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  function openAt(position: "first" | "last") {
    if (enabledIndexes.length === 0) return;
    setOpen(true);
    setActiveIndex(position === "first" ? enabledIndexes[0] : enabledIndexes[enabledIndexes.length - 1]);
  }

  function moveFocus(delta: 1 | -1) {
    if (enabledIndexes.length === 0) return;
    const currentPosition = enabledIndexes.indexOf(activeIndex);
    const nextPosition =
      currentPosition === -1
        ? 0
        : (currentPosition + delta + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPosition]);
  }

  function select(item: ActionMenuItem) {
    if (item.disabled) return;
    setOpen(false);
    setActiveIndex(-1);
    item.onSelect();
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? setOpen(false) : openAt("first"))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openAt("first");
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openAt("last");
          }
        }}
        className={`ha-btn ha-btn-secondary ha-btn-sm ${open ? "bg-[color:var(--muted)]" : ""}`}
      >
        <Icon name="more" size={14} />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveFocus(1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveFocus(-1);
            } else if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setActiveIndex(-1);
            } else if (event.key === "Tab") {
              setOpen(false);
            }
          }}
          className={`ha-card absolute z-40 mt-1 min-w-[12rem] p-1 shadow-[var(--shadow-lg)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ animation: "ha-menu-in 130ms var(--ease)" }}
        >
          {items.map((item, index) => (
            <button
              key={item.key}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              tabIndex={activeIndex === index ? 0 : -1}
              onClick={() => select(item)}
              className={`flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-[0.8125rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)] ${
                item.disabled
                  ? "cursor-not-allowed opacity-50"
                  : item.destructive
                    ? "text-[color:var(--danger)] hover:bg-[color:var(--danger-soft)]"
                    : "text-[color:var(--foreground)] hover:bg-[color:var(--muted)]"
              }`}
            >
              {item.icon ? (
                <span className="mt-0.5 shrink-0">
                  <Icon name={item.icon} size={14} />
                </span>
              ) : null}
              <span className="min-w-0">
                <span className="block truncate">{item.label}</span>
                {item.hint ? (
                  <span className="mt-0.5 block text-xs text-[color:var(--text-subtle)]">{item.hint}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
