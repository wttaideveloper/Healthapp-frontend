"use client";

import { useState } from "react";

import { ChartFrame, type ChartTable, type LegendItem } from "@/components/charts/ChartFrame";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { categoricalColor } from "@/components/charts/palette";
import { Icon } from "@/components/ui/Icon";
import type { GrowthSeries } from "@/lib/admin/analytics/metrics";
import type { DateRange } from "@/lib/admin/analytics/range";

/**
 * Growth over the selected range.
 *
 * Two views of the same series, never on two axes: "New" plots records created
 * per bucket, "Total" plots the running total seeded with everything that
 * predates the range. A series whose timestamps the backend does not return
 * renders its reason instead of a plot.
 */

type GrowthSectionProps = {
  series: GrowthSeries[];
  range: DateRange;
  isStale?: boolean;
};

type Mode = "new" | "cumulative";

function GrowthChart({ series, range, isStale }: { series: GrowthSeries; range: DateRange; isStale?: boolean }) {
  const [mode, setMode] = useState<Mode>("new");

  const color = categoricalColor(0);
  const values = mode === "new" ? series.newPerBucket : series.cumulative;
  const total = series.created.state === "ready" ? series.created.value : 0;

  const reason =
    series.created.state === "unavailable"
      ? (series.created.reason ?? "This series cannot be derived from the current API responses.")
      : series.buckets.length === 0
        ? "No records carry a timestamp in this range yet."
        : null;

  const legend: LegendItem[] = [
    {
      key: series.key,
      label: mode === "new" ? `New ${series.label.toLowerCase()}` : `Total ${series.label.toLowerCase()}`,
      color,
      // Legend mirrors the mark: a swatch for columns, a stroke for the line.
      shape: mode === "new" ? "rect" : "line",
      value: values.length > 0 ? (values[values.length - 1] ?? 0).toLocaleString() : undefined,
    },
  ];

  const table: ChartTable = {
    columns: ["Period", "New", "Total"],
    rows: series.buckets.map((bucket, index) => [
      bucket.longLabel,
      series.newPerBucket[index] ?? 0,
      series.cumulative[index] ?? 0,
    ]),
  };

  const summary =
    reason ??
    `${series.label} over ${range.label.toLowerCase()}: ${total.toLocaleString()} created across ${series.buckets.length} periods, ending at a running total of ${(series.cumulative[series.cumulative.length - 1] ?? 0).toLocaleString()}.`;

  const changeLabel =
    series.previous === null
      ? null
      : (() => {
          const delta = total - series.previous;
          return {
            delta,
            text: `${delta > 0 ? "+" : ""}${delta.toLocaleString()}${series.changePercent !== null ? ` (${series.changePercent > 0 ? "+" : ""}${series.changePercent}%)` : ""}`,
          };
        })();

  return (
    <ChartFrame
      title={series.label}
      description={
        series.created.state === "ready"
          ? `${total.toLocaleString()} in ${range.label.toLowerCase()}`
          : "Not derivable from the current API"
      }
      icon="trendUp"
      summary={summary}
      legend={legend}
      table={reason ? undefined : table}
      unavailableReason={reason}
      isStale={isStale}
      action={
        reason ? null : (
          <div className="flex items-center gap-1 rounded-lg bg-[color:var(--muted)] p-0.5" role="group" aria-label={`${series.label} view`}>
            {(["new", "cumulative"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => setMode(option)}
                className={`rounded-md px-2 py-1 text-[0.6875rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--accent)] ${
                  mode === option
                    ? "bg-[color:var(--card)] text-[color:var(--foreground)] shadow-[var(--shadow-xs)]"
                    : "text-[color:var(--text-muted)]"
                }`}
              >
                {option === "new" ? "New" : "Total"}
              </button>
            ))}
          </div>
        )
      }
    >
      <div>
        {changeLabel ? (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-[color:var(--text-muted)]">
            <Icon
              name={changeLabel.delta > 0 ? "trendUp" : changeLabel.delta < 0 ? "trendDown" : "minus"}
              size={12}
            />
            <span className="tabular-nums">{changeLabel.text}</span>
            <span>vs previous {range.days} days</span>
          </p>
        ) : null}
        {/* Per-period counts are discrete events -> columns. The running total is
            a continuous quantity -> line with an area wash. */}
        <TimeSeriesChart
          points={series.buckets.map((bucket) => ({
            key: bucket.key,
            label: bucket.label,
            longLabel: bucket.longLabel,
          }))}
          series={[{ key: series.key, label: legend[0].label, color, values }]}
          variant={mode === "new" ? "column" : "line"}
          fill={mode === "cumulative"}
          ariaLabel={`${series.label}, ${range.label}`}
        />
      </div>
    </ChartFrame>
  );
}

export function GrowthSection({ series, range, isStale }: GrowthSectionProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {series.map((entry) => (
        <GrowthChart key={entry.key} series={entry} range={range} isStale={isStale} />
      ))}
    </div>
  );
}
