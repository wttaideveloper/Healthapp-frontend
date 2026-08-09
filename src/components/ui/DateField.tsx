"use client";

import { KeyboardEvent as ReactKeyboardEvent, FocusEvent, useEffect, useId, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { formatCalendarDate, isCalendarDate, todayCalendarDate } from "@/lib/format";

/**
 * Calendar date picker.
 *
 * Speaks `YYYY-MM-DD` calendar dates end to end — no times, no timezones — so
 * the day an admin clicks is the day that gets stored. Callers convert to the
 * API's ISO instant at submit time with `calendarDateToIso`.
 *
 * Deliberately a button + popover rather than `<input type="date">`: the native
 * control renders itself from the browser locale, which is the machine-looking
 * `12/31/2026` this screen exists to get away from. The trigger always reads
 * `31 Dec 2026`.
 */

type DateFieldProps = {
  /** Id of the trigger, so an external `<label htmlFor>` points at it. */
  id: string;
  /** Selected day as `YYYY-MM-DD`; empty string when nothing is chosen. */
  value: string;
  onChange: (value: string) => void;
  /** Trigger text while nothing is chosen. */
  placeholder?: string;
  /** Name announced for the calendar, e.g. "Subscription expiry date". */
  label: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Ids of the hint and error paragraphs that describe this field. */
  describedBy?: string;
  /** Offer a "Clear" action inside the popover. */
  clearable?: boolean;
};

/** Monday-first, matching the `31 Dec 2026` reading order used everywhere else. */
const weekdays = [
  { short: "Mo", long: "Monday" },
  { short: "Tu", long: "Tuesday" },
  { short: "We", long: "Wednesday" },
  { short: "Th", long: "Thursday" },
  { short: "Fr", long: "Friday" },
  { short: "Sa", long: "Saturday" },
  { short: "Su", long: "Sunday" },
];

const monthLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dayLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

type DayCell = { date: string; day: number } | null;

function toUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function toCalendar(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/** Monday = 0, matching the weekday header order. */
function weekdayIndex(value: string): number {
  return (toUtc(value).getUTCDay() + 6) % 7;
}

function shiftDays(value: string, delta: number): string {
  const date = toUtc(value);
  date.setUTCDate(date.getUTCDate() + delta);
  return toCalendar(date);
}

/** Clamps the day, so 31 Jan + 1 month lands on 28 Feb rather than 3 Mar. */
function shiftMonths(value: string, delta: number): string {
  const date = toUtc(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + delta);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return toCalendar(date);
}

/** Weeks of the month `anchor` falls in, padded with nulls to whole weeks. */
function buildWeeks(anchor: string): DayCell[][] {
  const anchorDate = toUtc(anchor);
  const year = anchorDate.getUTCFullYear();
  const month = anchorDate.getUTCMonth();
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: DayCell[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= dayCount; day += 1) {
    cells.push({ day, date: toCalendar(new Date(Date.UTC(year, month, day))) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: DayCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

export function DateField({
  id,
  value,
  onChange,
  placeholder = "Select a date",
  label,
  disabled = false,
  invalid = false,
  describedBy,
  clearable = true,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  /** The day the calendar's keyboard focus sits on; also picks the month shown. */
  const [cursor, setCursor] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  /**
   * Month arrows move the cursor too, but clicking them must not yank focus
   * into the grid — only keyboard moves ask for the cursor day to take focus.
   */
  const wantsCursorFocusRef = useRef(false);
  const headingId = useId();

  const selected = isCalendarDate(value) ? value : "";
  const today = todayCalendarDate();
  const anchor = cursor || selected || today;
  const weeks = useMemo(() => buildWeeks(anchor), [anchor]);

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
    if (!open || !wantsCursorFocusRef.current) return;
    wantsCursorFocusRef.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${anchor}"]`)?.focus();
  }, [open, anchor]);

  function openCalendar() {
    if (disabled) return;
    wantsCursorFocusRef.current = true;
    setCursor(selected || today);
    setOpen(true);
  }

  function closeCalendar(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function commit(nextValue: string) {
    onChange(nextValue);
    closeCalendar();
  }

  function moveCursor(next: string) {
    wantsCursorFocusRef.current = true;
    setCursor(next);
  }

  function onGridKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    let next: string | null = null;

    if (event.key === "ArrowLeft") next = shiftDays(anchor, -1);
    else if (event.key === "ArrowRight") next = shiftDays(anchor, 1);
    else if (event.key === "ArrowUp") next = shiftDays(anchor, -7);
    else if (event.key === "ArrowDown") next = shiftDays(anchor, 7);
    else if (event.key === "Home") next = shiftDays(anchor, -weekdayIndex(anchor));
    else if (event.key === "End") next = shiftDays(anchor, 6 - weekdayIndex(anchor));
    else if (event.key === "PageUp") next = shiftMonths(anchor, event.shiftKey ? -12 : -1);
    else if (event.key === "PageDown") next = shiftMonths(anchor, event.shiftKey ? 12 : 1);
    else return;

    event.preventDefault();
    moveCursor(next);
  }

  /** Tabbing away from the whole control closes it. */
  function onContainerBlur(event: FocusEvent<HTMLDivElement>) {
    const nextFocus = event.relatedTarget as Node | null;
    // A null relatedTarget means focus went nowhere — clicking the popover's own
    // padding does that, and closing then would be maddening. Genuine clicks
    // outside are already covered by the document mousedown listener.
    if (!nextFocus || containerRef.current?.contains(nextFocus)) return;
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative" onBlur={onContainerBlur}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? closeCalendar(false) : openCalendar())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openCalendar();
          }
        }}
        className="ha-input flex cursor-pointer items-center gap-2 text-left"
      >
        <span className="shrink-0 text-[color:var(--text-muted)]">
          <Icon name="calendar" size={14} />
        </span>
        <span
          className={`min-w-0 flex-1 truncate ${selected ? "" : "text-[color:var(--text-subtle)]"}`}
        >
          {selected ? formatCalendarDate(selected) : placeholder}
        </span>
        <span className="shrink-0 text-[color:var(--text-subtle)]">
          <Icon name="chevronDown" size={14} />
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={`${label} calendar`}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            closeCalendar();
          }}
          className="ha-card absolute left-0 z-40 mt-1 w-[17.5rem] p-3 shadow-[var(--shadow-lg)]"
          style={{ animation: "ha-menu-in 130ms var(--ease)" }}
        >
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => setCursor(shiftMonths(anchor, -12))}
              className="ha-btn ha-btn-ghost ha-btn-sm ha-btn-icon"
            >
              <Icon name="chevronsLeft" size={14} />
            </button>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(shiftMonths(anchor, -1))}
              className="ha-btn ha-btn-ghost ha-btn-sm ha-btn-icon"
            >
              <Icon name="chevronLeft" size={14} />
            </button>
            <span
              id={headingId}
              aria-live="polite"
              className="min-w-0 flex-1 truncate text-center text-[0.8125rem] font-semibold text-[color:var(--foreground)]"
            >
              {monthLabelFormatter.format(toUtc(anchor))}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(shiftMonths(anchor, 1))}
              className="ha-btn ha-btn-ghost ha-btn-sm ha-btn-icon"
            >
              <Icon name="chevronRight" size={14} />
            </button>
            <button
              type="button"
              aria-label="Next year"
              onClick={() => setCursor(shiftMonths(anchor, 12))}
              className="ha-btn ha-btn-ghost ha-btn-sm ha-btn-icon"
            >
              <Icon name="chevronsRight" size={14} />
            </button>
          </div>

          <div ref={gridRef} role="grid" aria-labelledby={headingId} onKeyDown={onGridKeyDown} className="mt-2">
            <div role="row" className="grid grid-cols-7">
              {weekdays.map((weekday) => (
                <span
                  key={weekday.long}
                  role="columnheader"
                  aria-label={weekday.long}
                  className="py-1 text-center text-[0.6875rem] font-medium text-[color:var(--text-subtle)]"
                >
                  {weekday.short}
                </span>
              ))}
            </div>

            {weeks.map((week, weekIndex) => (
              <div role="row" key={`${anchor.slice(0, 7)}-w${weekIndex}`} className="grid grid-cols-7">
                {week.map((cell, cellIndex) => {
                  if (!cell) {
                    return <span role="gridcell" key={`${weekIndex}-blank-${cellIndex}`} />;
                  }

                  const isSelected = cell.date === selected;
                  const isToday = cell.date === today;

                  return (
                    <span role="gridcell" key={cell.date} aria-selected={isSelected} className="p-0.5">
                      <button
                        type="button"
                        data-date={cell.date}
                        tabIndex={cell.date === anchor ? 0 : -1}
                        aria-label={dayLabelFormatter.format(toUtc(cell.date))}
                        aria-current={isToday ? "date" : undefined}
                        onClick={() => commit(cell.date)}
                        className={`flex h-8 w-full items-center justify-center rounded-md text-[0.8125rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)] ${
                          isSelected
                            ? "bg-[color:var(--accent)] font-semibold text-white"
                            : isToday
                              ? "font-semibold text-[color:var(--accent)] hover:bg-[color:var(--muted)]"
                              : "text-[color:var(--foreground)] hover:bg-[color:var(--muted)]"
                        }`}
                      >
                        {cell.day}
                      </button>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-2 border-t border-[color:var(--border)] pt-2">
            <button type="button" onClick={() => commit(today)} className="ha-btn ha-btn-secondary ha-btn-sm flex-1">
              Today
            </button>
            {clearable ? (
              <button
                type="button"
                disabled={!selected}
                onClick={() => commit("")}
                className="ha-btn ha-btn-ghost ha-btn-sm flex-1"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
