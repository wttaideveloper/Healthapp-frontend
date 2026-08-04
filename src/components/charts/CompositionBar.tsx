"use client";

import { useState } from "react";

import { SURFACE_GAP } from "@/components/charts/palette";

/**
 * Single horizontal stacked bar for part-to-whole with very few categories.
 *
 * A ring with two slices is a pie chart of two numbers — the reader compares two
 * arcs when they could compare two lengths. Below three categories this form is
 * simply better, so `DistributionSection` switches to it automatically.
 *
 * Segments are separated by a gap in the surface colour, not a stroke. Labels sit
 * outside the bar in a legend row, because a two-character segment cannot hold
 * text without clipping it.
 */

export type CompositionSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type CompositionBarProps = {
  segments: CompositionSegment[];
  totalLabel?: string;
};

export function CompositionBar({ segments, totalLabel = "Total" }: CompositionBarProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-baseline gap-2">
          {/* Proportional figures: a standalone number, not a column. */}
          <span className="text-2xl font-semibold leading-none tracking-[-0.02em] text-[color:var(--foreground)]">
            {total.toLocaleString()}
          </span>
          <span className="text-xs text-[color:var(--text-muted)]">{totalLabel}</span>
        </div>

        <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[color:var(--muted)]">
          {segments.map((segment, index) => {
            const percent = total > 0 ? (segment.value / total) * 100 : 0;
            return (
              <div
                key={segment.key}
                className="h-full transition-opacity duration-150"
                style={{
                  width: `${percent}%`,
                  background: segment.color,
                  marginLeft: index > 0 ? SURFACE_GAP : 0,
                  opacity: activeKey === null || activeKey === segment.key ? 1 : 0.35,
                }}
              />
            );
          })}
        </div>
      </div>

      <ul className="space-y-0.5">
        {segments.map((segment) => (
          <li key={segment.key}>
            <button
              type="button"
              onMouseEnter={() => setActiveKey(segment.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(segment.key)}
              onBlur={() => setActiveKey(null)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--card-2)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)]"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: segment.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] capitalize text-[color:var(--text-muted)]">
                {segment.label}
              </span>
              <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums text-[color:var(--foreground)]">
                {segment.value.toLocaleString()}
              </span>
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[color:var(--text-subtle)]">
                {total > 0 ? `${Math.round((segment.value / total) * 100)}%` : "0%"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
