"use client";

import {
  FocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Icon } from "@/components/ui/Icon";

/**
 * Organization picker.
 *
 * A listbox rather than a native `<select>` because each row carries more than a
 * name: an admin choosing between five clinics needs to see licence pressure and
 * status to pick the right one. Selection is marked with a tick and bold text as
 * well as a tinted row, so it never depends on colour alone.
 *
 * Follows the ARIA listbox pattern: the trigger owns the accessible name and
 * expanded state, focus moves into the list on open, and a roving tabindex walks
 * the options.
 */

export type OrganizationOption = {
  id: string;
  name: string;
  /** Secondary line, e.g. "3 of 10 licenses used". */
  detail?: string;
  /** Badges rendered under the name — role, status, and so on. */
  badges?: ReactNode;
};

type OrganizationSelectProps = {
  /** Id of the trigger, so an external `<label htmlFor>` points at it. */
  id: string;
  /** Accessible name for the control, e.g. "Select organization". */
  label: string;
  /** Id of the selected option, or "" when nothing is chosen. */
  value: string;
  options: OrganizationOption[];
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Ids of the hint paragraphs that describe this control. */
  describedBy?: string;
  /** Heading above the option list. */
  listLabel?: string;
  /** Shown in place of the list when there is nothing to choose from. */
  emptyLabel?: string;
};

export function OrganizationSelect({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Select an organization",
  disabled = false,
  describedBy,
  listLabel = "Select organization",
  emptyLabel = "No organizations available",
}: OrganizationSelectProps) {
  const [open, setOpen] = useState(false);
  /** Option the roving tabindex currently sits on. */
  const [activeId, setActiveId] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const headingId = useId();

  const selected = options.find((option) => option.id === value) ?? null;
  const activeIndex = options.findIndex((option) => option.id === activeId);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onScroll(event: Event) {
      // The list scrolls itself once there are more than a handful of
      // organizations; only movement of the page behind it should dismiss.
      if (containerRef.current?.contains(event.target as Node)) return;
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

  useEffect(() => {
    if (!open || !activeId) return;
    listRef.current?.querySelector<HTMLElement>(`[data-option-id="${activeId}"]`)?.focus();
  }, [open, activeId]);

  function openList() {
    if (disabled || options.length === 0) return;
    setActiveId(value || options[0].id);
    setOpen(true);
  }

  function closeList(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function select(optionId: string) {
    onChange(optionId);
    closeList();
  }

  function onListKeyDown(event: ReactKeyboardEvent<HTMLUListElement>) {
    if (options.length === 0) return;
    const current = activeIndex >= 0 ? activeIndex : 0;
    let next: number | null = null;

    if (event.key === "ArrowDown") next = (current + 1) % options.length;
    else if (event.key === "ArrowUp") next = (current - 1 + options.length) % options.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(options[current].id);
      return;
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeList();
      return;
    } else return;

    event.preventDefault();
    setActiveId(options[next].id);
  }

  /** Tabbing away from the control closes it; see DateField for the null case. */
  function onContainerBlur(event: FocusEvent<HTMLDivElement>) {
    const nextFocus = event.relatedTarget as Node | null;
    if (!nextFocus || containerRef.current?.contains(nextFocus)) return;
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative" onBlur={onContainerBlur}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled || options.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={label}
        aria-describedby={describedBy}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={(event) => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          openList();
        }}
        className="ha-input flex w-full cursor-pointer items-center gap-2.5 text-left"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-(--accent-soft) text-accent">
          <Icon name="building" size={13} />
        </span>
        <span className={`min-w-0 flex-1 truncate font-medium ${selected ? "" : "text-text-subtle"}`}>
          {selected ? selected.name : options.length === 0 ? emptyLabel : placeholder}
        </span>
        <span className="shrink-0 text-text-subtle">
          <Icon name="chevronDown" size={14} />
        </span>
      </button>

      {open ? (
        <div
          className="ha-card absolute left-0 right-0 z-40 mt-1 overflow-hidden p-1 shadow-[var(--shadow-lg)]"
          style={{ animation: "ha-menu-in 130ms var(--ease)" }}
        >
          <p id={headingId} className="px-2.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-subtle">
            {listLabel}
          </p>

          <ul
            ref={listRef}
            role="listbox"
            id={listboxId}
            aria-labelledby={headingId}
            onKeyDown={onListKeyDown}
            className="ha-scroll max-h-72 overflow-y-auto overscroll-contain"
          >
            {options.map((option) => {
              const isSelected = option.id === value;

              return (
                <li
                  key={option.id}
                  role="option"
                  aria-selected={isSelected}
                  data-option-id={option.id}
                  tabIndex={option.id === activeId ? 0 : -1}
                  onClick={() => select(option.id)}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                    isSelected ? "bg-(--accent-soft)" : "hover:bg-muted"
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 ${isSelected ? "text-accent" : "text-transparent"}`}>
                    <Icon name="check" size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[0.8125rem] ${isSelected ? "font-semibold" : "font-medium"}`}>
                      {option.name}
                    </span>
                    {option.detail ? (
                      <span className="mt-0.5 block truncate text-xs tabular-nums text-text-muted">{option.detail}</span>
                    ) : null}
                    {option.badges ? <span className="mt-1.5 flex flex-wrap gap-1.5">{option.badges}</span> : null}
                  </span>
                  {isSelected ? <span className="sr-only">(currently selected)</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
