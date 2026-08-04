"use client";

import { categoricalColor, statusColor, type StatusTone } from "@/components/charts/palette";

/**
 * Horizontal category bars.
 *
 * Built from HTML rather than SVG: the labels are real text, every value is
 * directly labelled at the row end, and the whole row is the hit target. That
 * removes any dependence on a tooltip to read a value.
 *
 * Nominal categories all wear slot 1 — bar length already encodes magnitude, so
 * spending the identity channel on a value ramp would double-encode it. Rows
 * only take different colours when the category carries *status* meaning, and
 * then they wear reserved status tokens beside a text label, never colour alone.
 */

export type CategoryBar = {
  key: string;
  label: string;
  sublabel?: string | null;
  value: number;
  /** Rendered at the row end. Defaults to the localised value. */
  display?: string;
  /** 0–1. Defaults to `value / max(values)`. */
  share?: number;
  tone?: StatusTone | null;
};

type CategoryBarChartProps = {
  bars: CategoryBar[];
  /** Appended to each row's accessible name, e.g. "seats". */
  unit?: string;
  /** Caps the track at 100% of this instead of the largest bar. */
  scaleMax?: number;
  maxRows?: number;
  /** Renders an <ol> so assistive tech announces the rank position natively. */
  ordered?: boolean;
};

export function CategoryBarChart({
  bars,
  unit = "",
  scaleMax,
  maxRows,
  ordered = false,
}: CategoryBarChartProps) {
  const visible = maxRows ? bars.slice(0, maxRows) : bars;
  const largest = scaleMax ?? visible.reduce((best, bar) => Math.max(best, bar.value), 0);
  const List = ordered ? "ol" : "ul";

  return (
    <List className="flex flex-col gap-3">
      {visible.map((bar) => {
        const share = bar.share ?? (largest > 0 ? bar.value / largest : 0);
        const percent = Math.max(0, Math.min(100, share * 100));
        const color = bar.tone ? statusColor(bar.tone) : categoricalColor(0);
        const display = bar.display ?? bar.value.toLocaleString();

        return (
          <li
            key={bar.key}
            className="group -mx-2 rounded-lg px-2 py-1 transition-colors hover:bg-[color:var(--card-2)]"
            title={`${bar.label}: ${display}${unit ? ` ${unit}` : ""}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-[0.8125rem] font-medium text-[color:var(--foreground)]">
                  {bar.label}
                </span>
                {bar.sublabel ? (
                  <span className="shrink-0 truncate text-xs text-[color:var(--text-subtle)]">{bar.sublabel}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums text-[color:var(--foreground)]">
                {display}
              </span>
            </div>

            <div
              role="img"
              aria-label={`${bar.label}: ${display}${unit ? ` ${unit}` : ""}`}
              className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[color:var(--muted)]"
            >
              {/* Square at the baseline, 4px rounded at the data end. */}
              <div
                className="h-full transition-[width] duration-300 ease-out"
                style={{
                  width: `${bar.value > 0 ? Math.max(percent, 2) : 0}%`,
                  background: color,
                  borderRadius: "0 4px 4px 0",
                }}
              />
            </div>
          </li>
        );
      })}
    </List>
  );
}
