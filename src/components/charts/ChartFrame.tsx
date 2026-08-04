"use client";

import { useId, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";

/**
 * Shared chrome for every chart in the console.
 *
 * Provides the four things a chart must always ship with:
 *   1. a title + description, so the plot is never unlabelled
 *   2. a legend for two or more series (identity is never colour-alone)
 *   3. a screen-reader summary of what the chart shows
 *   4. a table view — the WCAG-clean twin, so no value is gated behind hover
 *
 * When data cannot be derived it renders an explanation instead of an empty
 * plot: the console never draws a chart it cannot back with real records.
 */

export type LegendItem = {
  key: string;
  label: string;
  color: string;
  /** Rendered at the row end (count, share, …). */
  value?: string;
  /** `line` mirrors line marks, `rect` mirrors bars and area fills. */
  shape?: "rect" | "line";
};

export type ChartTable = {
  columns: string[];
  rows: (string | number)[][];
};

type ChartFrameProps = {
  title: string;
  description?: string;
  icon?: IconName;
  /** Plain-language description of the plot, announced to screen readers. */
  summary: string;
  legend?: LegendItem[];
  table?: ChartTable;
  /** When set, the plot is replaced by an explanation. */
  unavailableReason?: string | null;
  /** Extra controls in the header (range chips, toggles). */
  action?: ReactNode;
  /** Held at reduced opacity during a refresh — no skeleton flash. */
  isStale?: boolean;
  className?: string;
  children: ReactNode;
};

export function ChartFrame({
  title,
  description,
  icon,
  summary,
  legend,
  table,
  unavailableReason = null,
  action,
  isStale = false,
  className = "",
  children,
}: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);
  const summaryId = useId();
  const tableId = useId();

  const hasTable = Boolean(table && table.rows.length > 0) && !unavailableReason;

  return (
    <section className={`ha-card flex flex-col ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--border)] px-5 py-4">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon ? (
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--muted)] text-[color:var(--text-muted)]">
              <Icon name={icon} size={15} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="ha-section-title">{title}</h3>
            {description ? <p className="ha-section-subtitle">{description}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {action}
          {hasTable ? (
            <button
              type="button"
              onClick={() => setShowTable((current) => !current)}
              aria-expanded={showTable}
              aria-controls={tableId}
              className="ha-btn ha-btn-ghost ha-btn-sm"
            >
              <Icon name={showTable ? "chart" : "table"} size={13} />
              {showTable ? "Chart" : "Table"}
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 flex-col p-5">
        {unavailableReason ? (
          <ChartUnavailable reason={unavailableReason} />
        ) : (
          <>
            {/* The summary is the chart's accessible description; it is visually
                hidden because the same information is on screen as marks. */}
            <p id={summaryId} className="sr-only">
              {summary}
            </p>

            {showTable && table ? (
              <div id={tableId} className="ha-scroll -mx-1 max-h-[19rem] overflow-auto px-1">
                <table className="ha-table">
                  <caption className="sr-only">{`${title} — table view`}</caption>
                  <thead>
                    <tr>
                      {table.columns.map((column, index) => (
                        <th key={column} scope="col" className={index === 0 ? "" : "text-right"}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className={cellIndex === 0 ? "" : "text-right tabular-nums"}
                          >
                            {typeof cell === "number" ? cell.toLocaleString() : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                aria-describedby={summaryId}
                className={`min-w-0 flex-1 transition-opacity duration-200 ${isStale ? "opacity-50" : "opacity-100"}`}
              >
                {children}
              </div>
            )}

            {legend && legend.length > 1 && !showTable ? <ChartLegend items={legend} /> : null}
          </>
        )}
      </div>
    </section>
  );
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-[color:var(--border)] pt-3.5">
      {items.map((item) => (
        <li key={item.key} className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={item.shape === "line" ? "h-0.5 w-3.5 shrink-0 rounded-full" : "h-2.5 w-2.5 shrink-0 rounded-[3px]"}
            style={{ background: item.color }}
          />
          <span className="truncate text-xs text-[color:var(--text-muted)]">{item.label}</span>
          {item.value ? (
            <span className="shrink-0 text-xs font-medium tabular-nums text-[color:var(--foreground)]">
              {item.value}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * The honest empty state: says what is missing and why, instead of drawing an
 * empty axis or filling the plot with sample data.
 */
export function ChartUnavailable({ reason, title = "Chart unavailable" }: { reason: string; title?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--muted)] text-[color:var(--text-subtle)]">
        <Icon name="chart" size={20} />
      </span>
      <p className="mt-3.5 text-sm font-semibold text-[color:var(--foreground)]">{title}</p>
      <p className="mt-1.5 max-w-sm text-[0.8125rem] leading-relaxed text-[color:var(--text-muted)]">{reason}</p>
    </div>
  );
}
