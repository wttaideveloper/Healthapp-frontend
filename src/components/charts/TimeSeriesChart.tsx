"use client";

import { useCallback, useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";

import { AREA_FILL_OPACITY, chartInk } from "@/components/charts/palette";
import { useMeasuredWidth } from "@/hooks/useMeasuredWidth";

/**
 * Time-series line / area chart.
 *
 * One y-axis, always — two measures of different scale get two charts, never a
 * second axis. Marks follow the house spec: 2px lines, a 10%-opacity area wash,
 * ≥8px end markers with a 2px surface ring, hairline solid gridlines.
 *
 * Interaction: a crosshair snaps to the nearest bucket on hover and on keyboard
 * arrow keys, and the readout lists every series at that point — the pointer
 * never has to land on a line. The tooltip enhances but never gates: the same
 * values are in the frame's table view.
 */

export type TimeSeriesPoint = { key: string; label: string; longLabel: string };

export type TimeSeriesSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

type TimeSeriesChartProps = {
  points: TimeSeriesPoint[];
  series: TimeSeriesSeries[];
  height?: number;
  /**
   * `line` for a continuous quantity (a running total), `column` for discrete
   * per-period counts. Sparse counts plotted as a line read as a row of spikes
   * between zeros and imply values that were never measured; columns say
   * "3 things happened that day" honestly.
   */
  variant?: "line" | "column";
  /** Area wash under the line. Only meaningful for a single line series. */
  fill?: boolean;
  formatValue?: (value: number) => string;
  /** Announced with the focused point; defaults to the series label. */
  ariaLabel?: string;
};

const PAD_LEFT = 46;
const PAD_RIGHT = 14;
const PAD_TOP = 14;
const AXIS_BAND = 26;
/** Cap the mark so a wide band keeps air around it. */
const MAX_COLUMN_WIDTH = 24;
/** Negative space that separates touching columns. */
const COLUMN_GAP = 2;

/** Square at the baseline, 4px rounded at the data end. */
function columnPath(x: number, top: number, width: number, height: number): string {
  if (height <= 0) return "";
  const radius = Math.min(4, width / 2, height);
  const bottom = top + height;
  return [
    `M${x} ${bottom}`,
    `L${x} ${top + radius}`,
    `Q${x} ${top} ${x + radius} ${top}`,
    `L${x + width - radius} ${top}`,
    `Q${x + width} ${top} ${x + width} ${top + radius}`,
    `L${x + width} ${bottom}`,
    "Z",
  ].join(" ");
}

function buildTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];

  const rawStep = max / count;
  const exponent = Math.floor(Math.log10(rawStep));
  const base = 10 ** exponent;
  const candidate = [1, 2, 2.5, 5, 10].map((multiple) => multiple * base).find((value) => value >= rawStep);
  // Counts are whole records, so never step by a fraction.
  const step = Math.max(1, candidate ?? 10 * base);

  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 1000; value += step) ticks.push(Math.round(value));
  return ticks;
}

/** Minimum distance between x-label centres, sized for "Aug 5"-style text. */
const MIN_LABEL_GAP = 52;

/**
 * X labels spaced by available pixels rather than by a fixed count.
 *
 * The final bucket is always labelled — it is the one the reader looks for — and
 * the tick before it is dropped when the two would collide. Deriving the stride
 * from a label-count guess instead lets the last two labels overlap on a narrow
 * card, which is exactly where it is least acceptable.
 */
function tickIndexes(total: number, spacing: number): Set<number> {
  if (total === 0) return new Set();
  if (total === 1) return new Set([0]);

  const stride = Math.max(1, Math.ceil(MIN_LABEL_GAP / Math.max(spacing, 1)));
  const kept: number[] = [];
  for (let index = 0; index < total; index += stride) kept.push(index);

  const last = total - 1;
  if (kept[kept.length - 1] !== last) {
    if ((last - kept[kept.length - 1]) * spacing < MIN_LABEL_GAP) kept.pop();
    kept.push(last);
  }

  return new Set(kept);
}

export function TimeSeriesChart({
  points,
  series,
  height = 210,
  variant = "line",
  fill = false,
  formatValue = (value) => value.toLocaleString(),
  ariaLabel = "Time series",
}: TimeSeriesChartProps) {
  const isColumn = variant === "column";
  const [containerRef, width] = useMeasuredWidth<HTMLDivElement>();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const clipId = useId();

  const plotWidth = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotHeight = Math.max(0, height - PAD_TOP - AXIS_BAND);

  const geometry = useMemo(() => {
    const max = series.reduce(
      (best, entry) => entry.values.reduce((innerBest, value) => Math.max(innerBest, value), best),
      0,
    );
    const ticks = buildTicks(max);
    const top = ticks[ticks.length - 1] || 1;

    // Columns occupy a band and sit at its centre; lines sit on the point itself.
    const band = points.length > 0 ? plotWidth / points.length : 0;
    const step = isColumn ? band : points.length > 1 ? plotWidth / (points.length - 1) : 0;

    const xAt = (index: number) =>
      isColumn
        ? PAD_LEFT + band * (index + 0.5)
        : points.length > 1
          ? PAD_LEFT + index * step
          : PAD_LEFT + plotWidth / 2;

    const yAt = (value: number) => PAD_TOP + plotHeight - (value / top) * plotHeight;
    const columnWidth = Math.max(2, Math.min(MAX_COLUMN_WIDTH, band - COLUMN_GAP));

    return { max, ticks, top, step, band, xAt, yAt, columnWidth };
  }, [series, points.length, plotWidth, plotHeight, isColumn]);

  const paths = useMemo(() => {
    if (plotWidth <= 0 || points.length === 0 || isColumn) return [];

    return series.map((entry) => {
      const commands = entry.values
        .slice(0, points.length)
        .map((value, index) => `${index === 0 ? "M" : "L"}${geometry.xAt(index).toFixed(2)} ${geometry.yAt(value).toFixed(2)}`)
        .join(" ");

      const lastIndex = Math.min(entry.values.length, points.length) - 1;
      const baseline = PAD_TOP + plotHeight;
      const area =
        lastIndex >= 0
          ? `${commands} L${geometry.xAt(lastIndex).toFixed(2)} ${baseline} L${geometry.xAt(0).toFixed(2)} ${baseline} Z`
          : "";

      return { key: entry.key, line: commands, area, lastIndex };
    });
  }, [series, points.length, geometry, plotWidth, plotHeight, isColumn]);

  const xLabelIndexes = useMemo(
    () => tickIndexes(points.length, isColumn ? geometry.band : geometry.step),
    [points.length, isColumn, geometry.band, geometry.step],
  );

  const resolveIndex = useCallback(
    (clientX: number, rect: DOMRect): number => {
      if (points.length <= 1) return 0;
      const relative = clientX - rect.left - PAD_LEFT;
      // Columns snap to the band the pointer is inside; lines to the nearest point.
      const index = isColumn
        ? Math.floor(relative / (geometry.band || 1))
        : Math.round(relative / (geometry.step || 1));
      return Math.min(points.length - 1, Math.max(0, index));
    },
    [points.length, geometry.step, geometry.band, isColumn],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      setActiveIndex(resolveIndex(event.clientX, rect));
    },
    [resolveIndex],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (points.length === 0) return;

      const move = (next: number) => {
        event.preventDefault();
        setActiveIndex(Math.min(points.length - 1, Math.max(0, next)));
      };

      const current = activeIndex ?? points.length - 1;
      if (event.key === "ArrowRight") return move(current + 1);
      if (event.key === "ArrowLeft") return move(current - 1);
      if (event.key === "Home") return move(0);
      if (event.key === "End") return move(points.length - 1);
      if (event.key === "Escape") setActiveIndex(null);
    },
    [activeIndex, points.length],
  );

  if (points.length === 0) return null;

  const activePoint = activeIndex === null ? null : points[activeIndex];
  const activeX = activeIndex === null ? 0 : geometry.xAt(activeIndex);
  const tooltipOnLeft = width > 0 && activeX > width * 0.6;
  /** Keeps the readout inside the card instead of spilling past its padding. */
  const TOOLTIP_WIDTH = 152;

  const liveText = activePoint
    ? `${activePoint.longLabel}: ${series
        .map((entry) => `${entry.label} ${formatValue(entry.values[activeIndex!] ?? 0)}`)
        .join(", ")}`
    : "";

  return (
    <div
      ref={containerRef}
      className="relative w-full outline-none focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
      style={{ height }}
      tabIndex={0}
      role="group"
      aria-label={`${ariaLabel}. Use arrow keys to move through ${points.length} data points.`}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setActiveIndex(null)}
      onFocus={() => setActiveIndex((current) => current ?? points.length - 1)}
      onBlur={() => setActiveIndex(null)}
      onKeyDown={handleKeyDown}
    >
      <span aria-live="polite" className="sr-only">
        {liveText}
      </span>

      {width > 0 ? (
        <svg width={width} height={height} aria-hidden="true" className="block overflow-visible">
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD_LEFT} y={PAD_TOP} width={plotWidth} height={plotHeight} />
            </clipPath>
          </defs>

          {/* Gridlines + y ticks — hairline, solid, recessive. */}
          {geometry.ticks.map((tick) => {
            const y = geometry.yAt(tick);
            return (
              <g key={tick}>
                <line
                  x1={PAD_LEFT}
                  x2={PAD_LEFT + plotWidth}
                  y1={y}
                  y2={y}
                  stroke={tick === 0 ? chartInk.axis : chartInk.grid}
                  strokeWidth={1}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={11}
                  fill={chartInk.subtle}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {tick.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Crosshair sits under the marks so it never obscures a value. On
              columns the band itself is the target, so it gets a wash instead. */}
          {activeIndex !== null ? (
            isColumn ? (
              <rect
                x={PAD_LEFT + geometry.band * activeIndex}
                y={PAD_TOP}
                width={geometry.band}
                height={plotHeight}
                fill={chartInk.grid}
                opacity={0.5}
              />
            ) : (
              <line
                x1={activeX}
                x2={activeX}
                y1={PAD_TOP}
                y2={PAD_TOP + plotHeight}
                stroke={chartInk.axis}
                strokeWidth={1}
              />
            )
          ) : null}

          {/* Columns: square at the baseline, 4px rounded at the data end, with a
              2px surface gap between neighbours. */}
          {isColumn
            ? series.map((entry) =>
                entry.values.slice(0, points.length).map((value, index) => {
                  const top = geometry.yAt(value);
                  const barHeight = PAD_TOP + plotHeight - top;
                  const path = columnPath(
                    geometry.xAt(index) - geometry.columnWidth / 2,
                    top,
                    geometry.columnWidth,
                    barHeight,
                  );
                  if (!path) return null;
                  return (
                    <path
                      key={`${entry.key}-${index}`}
                      d={path}
                      fill={entry.color}
                      opacity={activeIndex === null || activeIndex === index ? 1 : 0.55}
                    />
                  );
                }),
              )
            : null}

          <g clipPath={`url(#${clipId})`}>
            {paths.map((path, seriesIndex) => {
              const entry = series[seriesIndex];
              return (
                <g key={path.key}>
                  {fill && series.length === 1 && path.area ? (
                    <path d={path.area} fill={entry.color} fillOpacity={AREA_FILL_OPACITY} />
                  ) : null}
                  <path
                    d={path.line}
                    fill="none"
                    stroke={entry.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
          </g>

          {/* End markers and the focused point: 2px surface ring keeps them legible
              where lines cross. Columns need none — the mark is already solid. */}
          {paths.map((path, seriesIndex) => {
            const entry = series[seriesIndex];
            const marks = new Set<number>();
            if (path.lastIndex >= 0) marks.add(path.lastIndex);
            if (activeIndex !== null) marks.add(activeIndex);

            return Array.from(marks).map((index) => {
              const value = entry.values[index];
              if (value === undefined) return null;
              return (
                <circle
                  key={`${path.key}-${index}`}
                  cx={geometry.xAt(index)}
                  cy={geometry.yAt(value)}
                  r={index === activeIndex ? 5 : 4}
                  fill={entry.color}
                  stroke={chartInk.surface}
                  strokeWidth={2}
                />
              );
            });
          })}

          {/* X labels */}
          {points.map((point, index) => {
            if (!xLabelIndexes.has(index)) return null;
            const x = geometry.xAt(index);
            const anchor = index === 0 ? "start" : index === points.length - 1 ? "end" : "middle";
            return (
              <text
                key={point.key}
                x={x}
                y={PAD_TOP + plotHeight + 16}
                textAnchor={anchor}
                fontSize={11}
                fill={chartInk.subtle}
              >
                {point.label}
              </text>
            );
          })}
        </svg>
      ) : null}

      {activePoint && activeIndex !== null ? (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[9.5rem] rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 shadow-[var(--shadow-md)]"
          style={
            tooltipOnLeft
              ? { right: Math.max(0, Math.min(width - activeX + 10, width - TOOLTIP_WIDTH)) }
              : { left: Math.max(0, Math.min(activeX + 10, width - TOOLTIP_WIDTH)) }
          }
        >
          <p className="text-[0.6875rem] font-medium text-[color:var(--text-muted)]">{activePoint.longLabel}</p>
          <ul className="mt-1.5 space-y-1">
            {series.map((entry) => (
              <li key={entry.key} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-0.5 w-3 shrink-0 rounded-full"
                  style={{ background: entry.color }}
                />
                {/* Value leads, label follows — the reader already has the series. */}
                <span className="text-[0.8125rem] font-semibold tabular-nums text-[color:var(--foreground)]">
                  {formatValue(entry.values[activeIndex] ?? 0)}
                </span>
                <span className="truncate text-[0.6875rem] text-[color:var(--text-muted)]">{entry.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
