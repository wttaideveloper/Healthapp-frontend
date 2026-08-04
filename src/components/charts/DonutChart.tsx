"use client";

import { useMemo, useState } from "react";

import { chartInk, SURFACE_GAP } from "@/components/charts/palette";

/**
 * Part-to-whole ring.
 *
 * Used only for at-a-glance composition with six or fewer segments — comparing
 * close values is a bar's job, not a ring's. Segments are separated by a 2px gap
 * in the surface colour rather than by a stroke, so no non-data ink is added.
 *
 * The ring itself is decorative for assistive tech (`aria-hidden`): identity and
 * value live in the legend, which is a real list of focusable rows. Focusing or
 * hovering a legend row highlights its segment and lifts its value into the
 * centre, so keyboard and pointer reach exactly the same information.
 */

export type DonutSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  /** Shown in the centre when nothing is highlighted. */
  totalLabel?: string;
  size?: number;
  thickness?: number;
};

export function DonutChart({ segments, totalLabel = "Total", size = 168, thickness = 18 }: DonutChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const useGap = segments.length > 1;

  const arcs = useMemo(() => {
    let offset = 0;
    return segments.map((segment) => {
      const share = total > 0 ? segment.value / total : 0;
      const raw = share * circumference;
      // Never let the gap eat a whole small segment.
      const length = useGap ? Math.max(raw - SURFACE_GAP, Math.min(raw, 1)) : raw;
      const arc = { ...segment, share, length, offset, gapLength: raw };
      offset += raw;
      return arc;
    });
  }, [segments, total, circumference, useGap]);

  const active = arcs.find((arc) => arc.key === activeKey) ?? null;
  const centerValue = active ? active.value : total;
  const centerCaption = active ? active.label : totalLabel;
  const centerShare = active && total > 0 ? `${Math.round((active.value / total) * 100)}%` : null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        {/* overflow-visible: the highlighted segment grows 2px past the radius. */}
        <svg width={size} height={size} aria-hidden="true" className="block -rotate-90 overflow-visible">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={chartInk.grid}
            strokeWidth={thickness}
          />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={activeKey === arc.key ? thickness + 4 : thickness}
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={-arc.offset}
              opacity={activeKey === null || activeKey === arc.key ? 1 : 0.35}
              className="transition-[stroke-width,opacity] duration-150"
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {/* Proportional figures: a standalone number, not a column. */}
          <span className="text-2xl font-semibold leading-none tracking-[-0.02em] text-[color:var(--foreground)]">
            {centerValue.toLocaleString()}
          </span>
          <span className="mt-1 max-w-[6.5rem] truncate text-[0.6875rem] capitalize text-[color:var(--text-muted)]">
            {centerCaption}
          </span>
          {centerShare ? (
            <span className="text-[0.6875rem] tabular-nums text-[color:var(--text-subtle)]">{centerShare}</span>
          ) : null}
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-0.5">
        {arcs.map((arc) => (
          <li key={arc.key}>
            <button
              type="button"
              onMouseEnter={() => setActiveKey(arc.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(arc.key)}
              onBlur={() => setActiveKey(null)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--card-2)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)]"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: arc.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] capitalize text-[color:var(--text-muted)]">
                {arc.label}
              </span>
              <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums text-[color:var(--foreground)]">
                {arc.value.toLocaleString()}
              </span>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[color:var(--text-subtle)]">
                {total > 0 ? `${Math.round((arc.value / total) * 100)}%` : "0%"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
