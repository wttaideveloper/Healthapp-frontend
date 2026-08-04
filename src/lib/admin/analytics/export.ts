import type { CsvSection } from "@/lib/admin/analytics/csv";
import {
  kpiMeta,
  type Distribution,
  type GrowthSeries,
  type HealthRow,
  type KpiKey,
  type KpiSet,
  type MemberCoverage,
  type QuickInsight,
  type RankedList,
  type SeatUtilizationRow,
} from "@/lib/admin/analytics/metrics";
import type { DateRange } from "@/lib/admin/analytics/range";

/**
 * Assembles the CSV payload from already-computed analytics.
 *
 * Deliberately consumes the same objects the UI renders, so the export can never
 * drift from the screen. Unavailable metrics export a blank value plus the
 * reason rather than a zero.
 */
export function buildAnalyticsSections(input: {
  range: DateRange;
  coverage: MemberCoverage;
  generatedAt: Date;
  scope: string;
  kpis: KpiSet;
  health: HealthRow[];
  growth: GrowthSeries[];
  distributions: Distribution[];
  topLists: RankedList[];
  seatUtilization: SeatUtilizationRow[];
  quickInsights: QuickInsight[];
}): CsvSection[] {
  const {
    range,
    coverage,
    generatedAt,
    scope,
    kpis,
    health,
    growth,
    distributions,
    topLists,
    seatUtilization,
    quickInsights,
  } = input;

  const coverageLabel =
    coverage.mode === "full"
      ? `All workspaces (${coverage.workspacesCovered} of ${coverage.workspacesTotal} scanned${coverage.failedCount > 0 ? `, ${coverage.failedCount} failed` : ""})`
      : coverage.mode === "scoped"
        ? `Single workspace: ${coverage.scopeLabel}`
        : "No member data loaded";

  const sections: CsvSection[] = [
    {
      title: "HealthAge Analytics Export",
      headers: ["Field", "Value"],
      rows: [
        ["Generated at", generatedAt.toISOString()],
        ["Scope", scope],
        ["Date range", range.label],
        ["Range start", range.since === null ? "All time" : new Date(range.since).toISOString()],
        ["Range end", new Date(range.until).toISOString()],
        ["Member coverage", coverageLabel],
        ["Source", "Derived client-side from existing admin endpoints. No analytics API exists."],
      ],
    },
    {
      title: "Executive KPIs",
      headers: ["Metric", "Value", "Context", "Unavailable reason"],
      rows: (Object.keys(kpiMeta) as KpiKey[]).map((key) => {
        const metric = kpis[key];
        return [
          kpiMeta[key].label,
          metric.state === "ready" ? metric.value : null,
          metric.state === "ready" ? (metric.hint ?? "") : "",
          metric.state === "unavailable" ? (metric.reason ?? "Unavailable") : "",
        ];
      }),
    },
    {
      title: "System Health",
      headers: ["Signal", "Count", "Definition", "Unavailable reason"],
      rows: health.map((row) => [
        row.label,
        row.metric.state === "ready" ? row.metric.value : null,
        row.description,
        row.metric.state === "unavailable" ? (row.metric.reason ?? "Unavailable") : "",
      ]),
    },
    {
      title: "Growth Summary",
      headers: ["Series", "Created in range", "Previous period", "Change %", "Unavailable reason"],
      rows: growth.map((series) => [
        series.label,
        series.created.state === "ready" ? series.created.value : null,
        series.previous,
        series.changePercent,
        series.created.state === "unavailable" ? (series.created.reason ?? "Unavailable") : "",
      ]),
    },
  ];

  for (const series of growth) {
    if (series.buckets.length === 0) continue;
    sections.push({
      title: `Growth series — ${series.label}`,
      headers: ["Period", "New", "Cumulative"],
      rows: series.buckets.map((bucket, index) => [
        bucket.longLabel,
        series.newPerBucket[index] ?? 0,
        series.cumulative[index] ?? 0,
      ]),
    });
  }

  for (const distribution of distributions) {
    if (distribution.reason !== null) {
      sections.push({
        title: `Distribution — ${distribution.title}`,
        headers: ["Category", "Count", "Share %"],
        rows: [[`Unavailable: ${distribution.reason}`, null, null]],
      });
      continue;
    }
    const total = distribution.slices.reduce((sum, slice) => sum + slice.value, 0);
    sections.push({
      title: `Distribution — ${distribution.title}`,
      headers: ["Category", "Count", "Share %"],
      rows: distribution.slices.map((slice) => [
        slice.label,
        slice.value,
        total > 0 ? Math.round((slice.value / total) * 100) : 0,
      ]),
    });
  }

  if (seatUtilization.length > 0) {
    sections.push({
      title: "Seat Utilization",
      headers: ["Workspace", "Seats used", "Seat limit", "Utilization %"],
      rows: seatUtilization.map((row) => [row.name, row.used, row.limit, row.percent]),
    });
  }

  for (const list of topLists) {
    sections.push({
      title: `Top — ${list.title}`,
      headers: ["Rank", "Name", "Detail", "Value"],
      rows:
        list.reason !== null
          ? [[null, `Unavailable: ${list.reason}`, "", null]]
          : list.entries.map((entry, index) => [
              index + 1,
              entry.label,
              entry.sublabel ?? "",
              entry.display,
            ]),
    });
  }

  sections.push({
    title: "Quick Insights",
    headers: ["Insight", "Derived from"],
    rows: quickInsights.map((insight) => [insight.message, insight.basis]),
  });

  return sections;
}
