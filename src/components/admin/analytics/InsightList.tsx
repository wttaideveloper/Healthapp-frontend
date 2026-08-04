"use client";

import { CategoryBarChart, type CategoryBar } from "@/components/charts/CategoryBarChart";
import { EmptyState, SectionCard } from "@/components/ui/Section";
import type { RankedList } from "@/lib/admin/analytics/metrics";

/**
 * A ranked "top N" panel.
 *
 * Rows come straight from `computeTopLists` — no re-sorting or re-labelling here,
 * so the presentation layer cannot drift from the calculation. A list with no
 * derivable rows renders its reason instead of an empty frame.
 */

type InsightListProps = {
  list: RankedList;
  /** Appended to each row's accessible name. */
  unit?: string;
  /** Rows already carry rank order; the bar shows relative magnitude. */
  showBars?: boolean;
};

export function InsightList({ list, unit = "", showBars = true }: InsightListProps) {
  const bars: CategoryBar[] = list.entries.map((entry) => ({
    key: entry.key,
    label: entry.label,
    sublabel: entry.sublabel,
    value: entry.value,
    display: entry.display,
    share: entry.share,
    tone: entry.tone === "good" ? "good" : entry.tone === "warning" ? "warning" : entry.tone === "critical" ? "critical" : null,
  }));

  return (
    <SectionCard title={list.title} description={list.description} icon="chart">
      {list.reason !== null || bars.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Nothing to rank yet"
          description={list.reason ?? "No records match this ranking."}
        />
      ) : showBars ? (
        <CategoryBarChart bars={bars} unit={unit} ordered />
      ) : (
        <ol className="space-y-2.5">
          {list.entries.map((entry, index) => (
            <li key={entry.key} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-xs tabular-nums text-[color:var(--text-subtle)]">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium text-[color:var(--foreground)]">
                  {entry.label}
                </span>
                {entry.sublabel ? (
                  <span className="block truncate text-xs text-[color:var(--text-muted)]">{entry.sublabel}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums text-[color:var(--foreground)]">
                {entry.display}
              </span>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
