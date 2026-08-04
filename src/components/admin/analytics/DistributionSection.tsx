"use client";

import { useMemo } from "react";

import { ChartFrame, type ChartTable } from "@/components/charts/ChartFrame";
import { CompositionBar } from "@/components/charts/CompositionBar";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import { categoricalColor, statusColor } from "@/components/charts/palette";
import type { Distribution } from "@/lib/admin/analytics/metrics";

/** Below this many categories a ring is a two-slice pie; a stacked bar reads better. */
const DONUT_MIN_SEGMENTS = 3;

/**
 * Part-to-whole composition charts.
 *
 * Status distributions wear reserved status tokens (a "revoked" slice is red
 * because it *means* revoked, not because it is the third slice); identity
 * distributions wear categorical slots, indexed by the category's fixed position
 * so an empty category never repaints the ones after it.
 */

function toSegments(distribution: Distribution): DonutSegment[] {
  return distribution.slices.map((slice) => ({
    key: slice.key,
    label: slice.label,
    value: slice.value,
    color: distribution.isStatus ? statusColor(slice.tone, slice.colorIndex) : categoricalColor(slice.colorIndex),
  }));
}

function DistributionCard({ distribution, isStale }: { distribution: Distribution; isStale?: boolean }) {
  const segments = useMemo(() => toSegments(distribution), [distribution]);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  const reason =
    distribution.reason ?? (total === 0 ? "No records fall into any category yet." : null);

  const table: ChartTable = {
    columns: ["Category", "Count", "Share"],
    rows: segments.map((segment) => [
      segment.label,
      segment.value,
      total > 0 ? `${Math.round((segment.value / total) * 100)}%` : "0%",
    ]),
  };

  const summary =
    reason ??
    `${distribution.title}: ${segments
      .map((segment) => `${segment.label} ${segment.value} (${Math.round((segment.value / total) * 100)}%)`)
      .join(", ")}. Total ${total}.`;

  return (
    <ChartFrame
      title={distribution.title}
      description={distribution.description}
      icon="pieChart"
      summary={summary}
      table={reason ? undefined : table}
      unavailableReason={reason}
      isStale={isStale}
    >
      {segments.length >= DONUT_MIN_SEGMENTS ? (
        <DonutChart segments={segments} totalLabel="Total" />
      ) : (
        <CompositionBar segments={segments} totalLabel="Total" />
      )}
    </ChartFrame>
  );
}

export function DistributionSection({
  distributions,
  isStale,
}: {
  distributions: Distribution[];
  isStale?: boolean;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {distributions.map((distribution) => (
        <DistributionCard key={distribution.key} distribution={distribution} isStale={isStale} />
      ))}
    </div>
  );
}
