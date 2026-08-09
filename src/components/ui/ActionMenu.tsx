"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

type MenuPosition = {
  top: number;
  left: number;
  maxHeight: number;
};

/** Breathing room kept between the menu and every edge of the viewport. */
const viewportMargin = 8;
/** Gap between the trigger and the menu. */
const triggerGap = 4;

/**
 * `useLayoutEffect` warns when it runs during server rendering. The menu is only
 * ever measured after a click, but the hook call itself happens on both passes.
 */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function ActionMenu({ items, label, align = "right" }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const enabledIndexes = items.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      // The menu is portalled out of the trigger's DOM subtree, so "outside"
      // has to account for both halves — otherwise pressing an item would
      // dismiss the menu before its own click handler ever ran.
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onScroll(event: Event) {
      // A long menu scrolls itself; only movement of the page underneath — which
      // would strand the fixed-position menu away from its trigger — dismisses.
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onResize() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  /**
   * Anchors the menu to its trigger in viewport coordinates.
   *
   * The trigger usually sits in the last cell of a scrolling table, so an
   * absolutely positioned menu was clipped by that container. Rendering it into
   * `document.body` at fixed coordinates escapes every `overflow` ancestor;
   * measuring first is what lets it flip above the trigger and pull back inside
   * the screen edges instead of disappearing off them.
   */
  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    // Align to the requested edge, then pull back inside the viewport. On a
    // narrow phone the clamp wins and the menu simply sits against the margin.
    const preferredLeft = align === "right" ? triggerRect.right - menuRect.width : triggerRect.left;
    const left = Math.max(
      viewportMargin,
      Math.min(preferredLeft, viewportWidth - menuRect.width - viewportMargin),
    );

    const spaceBelow = viewportHeight - triggerRect.bottom - triggerGap - viewportMargin;
    const spaceAbove = triggerRect.top - triggerGap - viewportMargin;
    const flipUp = menuRect.height > spaceBelow && spaceAbove > spaceBelow;

    setPosition({
      left,
      top: flipUp
        ? Math.max(viewportMargin, triggerRect.top - triggerGap - menuRect.height)
        : triggerRect.bottom + triggerGap,
      // Whatever is left over becomes the scroll box, so a menu taller than the
      // screen stays reachable rather than running off the bottom.
      maxHeight: Math.max(120, flipUp ? spaceAbove : spaceBelow),
    });
  }, [open, align, items.length]);

  // Waits for `position`, because the measuring pass renders the menu hidden and
  // focus does not move to an element with `visibility: hidden`.
  useEffect(() => {
    if (open && position && activeIndex >= 0) itemRefs.current[activeIndex]?.focus();
  }, [open, position, activeIndex]);

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
    // Focus goes back to the trigger before the action runs: the item button is
    // about to unmount, and an action that opens a dialog will remember whatever
    // holds focus now as the place to return to when it closes.
    triggerRef.current?.focus();
    item.onSelect();
  }

  const menu = (
    <div
      ref={menuRef}
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
          triggerRef.current?.focus();
        } else if (event.key === "Tab") {
          setOpen(false);
        }
      }}
      className="ha-card ha-scroll fixed z-50 min-w-[12rem] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain p-1 shadow-[var(--shadow-lg)]"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        maxHeight: position?.maxHeight,
        // Hidden for the measuring pass only; the layout effect fills `position`
        // in before the browser paints, so nothing flashes.
        visibility: position ? "visible" : "hidden",
        animation: position ? "ha-menu-in 130ms var(--ease)" : undefined,
      }}
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
  );

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={triggerRef}
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

      {open ? createPortal(menu, document.body) : null}
    </div>
  );
}
