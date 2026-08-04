"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnalyticsToolbar } from "@/components/admin/analytics/AnalyticsToolbar";
import { DistributionSection } from "@/components/admin/analytics/DistributionSection";
import { GrowthSection } from "@/components/admin/analytics/GrowthSection";
import { HealthPanel } from "@/components/admin/analytics/HealthPanel";
import { InsightList } from "@/components/admin/analytics/InsightList";
import { KpiCard, type KpiDelta } from "@/components/admin/analytics/KpiCard";
import { QuickInsights } from "@/components/admin/analytics/QuickInsights";
import { CategoryBarChart } from "@/components/charts/CategoryBarChart";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Icon, type IconName } from "@/components/ui/Icon";
import { EmptyState, SectionCard } from "@/components/ui/Section";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { buildCsv, canExportCsv, csvFilename, downloadCsv } from "@/lib/admin/analytics/csv";
import { buildAnalyticsSections } from "@/lib/admin/analytics/export";
import { scanWorkspaceMembers, type MemberScanResult } from "@/lib/admin/analytics/memberScan";
import {
  computeDistributions,
  computeGrowth,
  computeHealth,
  computeKpis,
  computeQuickInsights,
  computeSeatUtilization,
  computeTopLists,
  kpiMeta,
  scopedCoverage,
  toMembershipRows,
  toWorkspaceRows,
  MEMBER_COVERAGE_NOTE,
  type AnalyticsInput,
  type KpiKey,
  type MemberCoverage,
} from "@/lib/admin/analytics/metrics";
import { buildDateRange, isRangeKey, type RangeKey } from "@/lib/admin/analytics/range";
import { tokenStorageKey } from "@/lib/admin/storage";
import type { AdminUser, Workspace, WorkspaceMember, WorkspaceMembership } from "@/types/admin";

/**
 * Executive analytics dashboard.
 *
 * Reads only from data the console has already loaded through existing
 * endpoints, plus one explicitly requested fan-out over the existing
 * per-workspace member routes. No endpoint is added, no authentication or
 * routing is touched, and no figure is invented: anything that cannot be derived
 * renders an explanation in place of a number.
 *
 * All heavy derivation is memoised on `[data, range, coverage]`, so switching a
 * date range or hovering a chart never recomputes the whole analytics tree.
 */

const RANGE_STORAGE_KEY = "healthage.admin.analytics.range";

const kpiOrder: Array<{ key: KpiKey; icon: IconName }> = [
  { key: "totalUsers", icon: "users" },
  { key: "activeUsers", icon: "badgeCheck" },
  { key: "totalWorkspaces", icon: "building" },
  { key: "activeWorkspaces", icon: "check" },
  { key: "totalMembers", icon: "users" },
  { key: "pendingInvitations", icon: "mailClock" },
  { key: "seatsUsed", icon: "gauge" },
  { key: "seatsAvailable", icon: "grid" },
  { key: "activeSubscriptions", icon: "creditCard" },
  { key: "lockedWorkspaces", icon: "lock" },
];

type AnalyticsViewProps = {
  isPlatformAdmin: boolean;
  workspaces: Workspace[];
  myWorkspaces: WorkspaceMembership[];
  users: AdminUser[];
  /** Members of the currently selected workspace only. */
  members: WorkspaceMember[];
  /** Name of the workspace `members` belongs to, or null. */
  membersScopeLabel: string | null;
  isLoadingDashboard: boolean;
  dashboardError: string | null;
  onRefreshData: () => void;
  onNotify: (type: "success" | "error", message: string) => void;
};

/**
 * Establishes the clock before any analytics render.
 *
 * Every figure below is relative to "now" — date buckets, "expires within 14
 * days", "3d ago". Reading the clock during render would bake the server's
 * timestamp into the SSR markup and then disagree with the client's, which React
 * reports as a hydration mismatch and re-renders the whole tree over. Resolving
 * it in an effect makes the first client render the only one that ever runs.
 *
 * It is deliberately frozen per data load rather than read on every render: a
 * moving clock would flicker the health signals and invalidate every memo.
 */
export function AnalyticsView(props: AnalyticsViewProps) {
  const { isLoadingDashboard, workspaces, users, members } = props;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Hold the previous clock during a refresh so the frame does not jump.
    setNow((current) => (current !== null && isLoadingDashboard ? current : Date.now()));
  }, [isLoadingDashboard, workspaces, users, members]);

  if (now === null) return <AnalyticsBootstrap />;
  return <AnalyticsDashboard {...props} now={now} />;
}

/** Matches the loaded layout's first screen so mounting causes no layout jump. */
function AnalyticsBootstrap() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="ha-card h-[3.75rem]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 10 }, (_, index) => (
          <article key={index} className="ha-card p-5">
            <div className="ha-skeleton h-3.5 w-24" />
            <div className="ha-skeleton mt-5 h-8 w-20" />
            <div className="ha-skeleton mt-2 h-3 w-28" />
          </article>
        ))}
      </div>
      <span className="sr-only">Loading analytics</span>
    </div>
  );
}

function AnalyticsDashboard(props: AnalyticsViewProps & { now: number }) {
  const {
    isPlatformAdmin,
    workspaces,
    myWorkspaces,
    users,
    members,
    membersScopeLabel,
    isLoadingDashboard,
    dashboardError,
    onRefreshData,
    onNotify,
    now,
  } = props;

  const [rangeKey, setRangeKey] = useLocalStorageState<RangeKey>(RANGE_STORAGE_KEY, "30d", isRangeKey);
  const [scan, setScan] = useState<MemberScanResult | null>(null);
  const [scanProgress, setScanProgress] = useState<{ completed: number; total: number } | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const rows = useMemo(
    () => (isPlatformAdmin ? toWorkspaceRows(workspaces) : toMembershipRows(myWorkspaces)),
    [isPlatformAdmin, workspaces, myWorkspaces],
  );

  /** Stable identity of the current workspace set — invalidates a stale scan. */
  const workspaceSignature = useMemo(
    () =>
      rows
        .map((row) => row.id)
        .sort()
        .join("|"),
    [rows],
  );

  useEffect(() => {
    // A scan is only valid for the workspace set it covered.
    setScan(null);
  }, [workspaceSignature]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const coverage: MemberCoverage = useMemo(() => {
    if (scan) {
      return {
        mode: "full",
        scopeLabel: null,
        workspacesCovered: scan.coveredCount,
        workspacesTotal: scan.requestedCount,
        failedCount: scan.failures.length,
      };
    }
    return scopedCoverage(members.length > 0 ? membersScopeLabel : null, rows.length);
  }, [scan, members.length, membersScopeLabel, rows.length]);

  const effectiveMembers = scan ? scan.members : members;

  const range = useMemo(() => buildDateRange(rangeKey, now), [rangeKey, now]);

  const input: AnalyticsInput = useMemo(
    () => ({ isPlatformAdmin, rows, users, members: effectiveMembers, coverage, range, now }),
    [isPlatformAdmin, rows, users, effectiveMembers, coverage, range, now],
  );

  const kpis = useMemo(() => computeKpis(input), [input]);
  const health = useMemo(() => computeHealth(input), [input]);
  const growth = useMemo(() => computeGrowth(input), [input]);
  const distributions = useMemo(() => computeDistributions(input), [input]);
  const topLists = useMemo(() => computeTopLists(input), [input]);
  const seatUtilization = useMemo(() => computeSeatUtilization(input), [input]);
  const quickInsights = useMemo(
    () => computeQuickInsights(input, kpis, health, growth),
    [input, kpis, health, growth],
  );

  const growthByKey = useMemo(() => new Map(growth.map((series) => [series.key, series])), [growth]);

  /** Trend + delta are attached only where a real timestamped series exists. */
  const kpiExtras = useMemo(() => {
    const extras = new Map<KpiKey, { delta: KpiDelta | null; trend: number[] | undefined }>();
    const periodLabel = range.days === null ? "all time" : `the last ${range.days} days`;

    const attach = (kpiKey: KpiKey, seriesKey: string) => {
      const series = growthByKey.get(seriesKey);
      if (!series || series.created.state !== "ready" || series.buckets.length === 0) return;
      extras.set(kpiKey, {
        delta:
          range.days === null
            ? null
            : { change: series.created.value, percent: series.changePercent, periodLabel },
        trend: series.cumulative,
      });
    };

    attach("totalUsers", "users");
    attach("totalWorkspaces", "workspaces");
    return extras;
  }, [growthByKey, range.days]);

  const hasAnyData = rows.length > 0 || users.length > 0 || members.length > 0;
  const isFirstLoad = isLoadingDashboard && !hasAnyData;

  /* ------------------------------------------------------------ member scan */

  const scanTargets = useMemo(() => rows.map((row) => ({ id: row.id, name: row.name })), [rows]);

  const startScan = useCallback(async () => {
    const token = typeof window === "undefined" ? null : window.localStorage.getItem(tokenStorageKey);
    if (!token) {
      onNotify("error", "Session token unavailable. Refresh the dashboard and try again.");
      return;
    }
    if (scanTargets.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsScanning(true);
    setScanProgress({ completed: 0, total: scanTargets.length });

    try {
      const result = await scanWorkspaceMembers({
        token,
        workspaces: scanTargets,
        isPlatformAdmin,
        signal: controller.signal,
        onProgress: (completed, total) => setScanProgress({ completed, total }),
      });
      setScan(result);
      onNotify(
        result.failures.length > 0 ? "error" : "success",
        result.failures.length > 0
          ? `Scanned ${result.coveredCount} of ${result.requestedCount} workspaces — ${result.failures.length} failed.`
          : `Member analytics now cover all ${result.coveredCount} workspaces.`,
      );
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        onNotify("error", error instanceof Error ? error.message : "Member scan failed");
      }
    } finally {
      abortRef.current = null;
      setIsScanning(false);
      setScanProgress(null);
    }
  }, [scanTargets, isPlatformAdmin, onNotify]);

  const cancelScan = useCallback(() => abortRef.current?.abort(), []);

  /* ----------------------------------------------------------------- export */

  const handleExport = useCallback(() => {
    const sections = buildAnalyticsSections({
      range,
      coverage,
      generatedAt: new Date(),
      scope: isPlatformAdmin ? "Platform (all workspaces)" : "Workspaces you administer",
      kpis,
      health,
      growth,
      distributions,
      topLists,
      seatUtilization,
      quickInsights,
    });

    const succeeded = downloadCsv(csvFilename("healthage-analytics"), buildCsv(sections));
    onNotify(
      succeeded ? "success" : "error",
      succeeded ? "Analytics exported to CSV." : "Could not start the CSV download.",
    );
  }, [
    range,
    coverage,
    isPlatformAdmin,
    kpis,
    health,
    growth,
    distributions,
    topLists,
    seatUtilization,
    quickInsights,
    onNotify,
  ]);

  const exportHandler = canExportCsv() && hasAnyData ? handleExport : null;

  /* ------------------------------------------------------------------- view */

  if (!isFirstLoad && rows.length === 0 && users.length === 0) {
    return (
      <SectionCard title="Analytics" description="Executive view of platform health" icon="chart">
        <EmptyState
          icon="chart"
          title="No data to analyse yet"
          description={
            isPlatformAdmin
              ? "Analytics are derived from workspaces, accounts, and members. Provision a workspace to start building history."
              : "Analytics cover the workspaces you administer. Once you hold an owner or admin seat, figures will appear here."
          }
          note="This console derives every figure client-side; the API exposes no analytics endpoint."
          action={
            <button type="button" onClick={onRefreshData} className="ha-btn ha-btn-secondary ha-btn-sm">
              <Icon name="refresh" size={13} />
              Refresh
            </button>
          }
        />
      </SectionCard>
    );
  }

  const seatChartReason =
    seatUtilization.length === 0
      ? "No workspace defines a seat limit, so utilisation cannot be computed."
      : null;

  return (
    <div className="space-y-5">
      <AnalyticsToolbar
        range={rangeKey}
        onRangeChange={setRangeKey}
        onRefresh={onRefreshData}
        isRefreshing={isLoadingDashboard}
        onExport={exportHandler}
        memberScan={{
          canScan: rows.length > 0,
          isScanning,
          progress: scanProgress,
          onStart: () => void startScan(),
          onCancel: cancelScan,
          label: scan ? "Rescan members" : `Scan members (${rows.length})`,
        }}
      />

      {dashboardError ? (
        <div
          role="alert"
          className="ha-card flex items-start gap-3 border-[color:rgba(220,38,38,0.3)] bg-[color:var(--danger-soft)] p-4"
        >
          <span className="mt-0.5 text-[color:var(--danger)]">
            <Icon name="alert" size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-semibold text-[color:var(--danger)]">Analytics data failed to load</p>
            <p className="mt-1 text-xs leading-relaxed text-[color:var(--danger)] opacity-90">{dashboardError}</p>
          </div>
          <button type="button" onClick={onRefreshData} className="ha-btn ha-btn-secondary ha-btn-sm ml-auto">
            <Icon name="refresh" size={13} />
            Retry
          </button>
        </div>
      ) : null}

      <MemberCoverageBanner
        coverage={coverage}
        isScanning={isScanning}
        progress={scanProgress}
        onStart={() => void startScan()}
        failures={scan?.failures ?? []}
      />

      {/* ------------------------------------------------------------- KPIs */}
      <section aria-labelledby="analytics-kpis">
        <h2 id="analytics-kpis" className="sr-only">
          Executive key performance indicators
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {kpiOrder.map(({ key, icon }) => {
            const extras = kpiExtras.get(key);
            return (
              <KpiCard
                key={key}
                label={kpiMeta[key].label}
                description={kpiMeta[key].description}
                metric={kpis[key]}
                icon={icon}
                delta={extras?.delta ?? null}
                trend={extras?.trend}
                isLoading={isFirstLoad}
                isStale={isLoadingDashboard && hasAnyData}
              />
            );
          })}
        </div>
      </section>

      <QuickInsights insights={quickInsights} />

      {/* ----------------------------------------------- health + seat load */}
      <div className="grid gap-5 xl:grid-cols-2">
        <HealthPanel rows={health} />

        <ChartFrame
          title="Seat Utilization"
          description="Workspaces with a seat limit, most pressured first"
          icon="gauge"
          summary={
            seatChartReason ??
            `Seat utilisation across ${seatUtilization.length} workspaces: ${seatUtilization
              .map((row) => `${row.name} ${row.percent}% (${row.used} of ${row.limit})`)
              .join(", ")}.`
          }
          unavailableReason={seatChartReason}
          isStale={isLoadingDashboard && hasAnyData}
          table={
            seatChartReason
              ? undefined
              : {
                  columns: ["Workspace", "Used", "Limit", "Utilization"],
                  rows: seatUtilization.map((row) => [row.name, row.used, row.limit ?? 0, `${row.percent}%`]),
                }
          }
        >
          <CategoryBarChart
            unit="percent used"
            scaleMax={100}
            bars={seatUtilization.map((row) => ({
              key: row.id,
              label: row.name,
              sublabel: `${row.used} of ${row.limit}`,
              value: row.percent,
              display: `${row.percent}%`,
              share: row.percent / 100,
              tone: row.tone,
            }))}
          />
        </ChartFrame>
      </div>

      {/* ----------------------------------------------------------- growth */}
      <section aria-labelledby="analytics-growth" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="analytics-growth" className="ha-section-title">
            Growth Insights
          </h2>
          <p className="text-xs text-[color:var(--text-subtle)]">
            Reconstructed from record timestamps · {range.label}
          </p>
        </div>
        <GrowthSection series={growth} range={range} isStale={isLoadingDashboard && hasAnyData} />
      </section>

      {/* ---------------------------------------------------- distributions */}
      <section aria-labelledby="analytics-distributions" className="space-y-3">
        <h2 id="analytics-distributions" className="ha-section-title">
          Distributions
        </h2>
        <DistributionSection distributions={distributions} isStale={isLoadingDashboard && hasAnyData} />
      </section>

      {/* -------------------------------------------------------- top lists */}
      <section aria-labelledby="analytics-top" className="space-y-3">
        <h2 id="analytics-top" className="ha-section-title">
          Top Insights
        </h2>
        <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
          {topLists.map((list) => (
            <InsightList
              key={list.key}
              list={list}
              unit={list.key === "highest-utilization" ? "percent used" : ""}
              showBars={list.key !== "recent-workspaces" && list.key !== "recent-members"}
            />
          ))}
        </div>
      </section>

      <p className="pb-2 text-xs leading-relaxed text-[color:var(--text-subtle)]">
        Every figure on this page is computed in the browser from records returned by the existing admin endpoints.
        There is no analytics API, no aggregation service, and no sampled data. {MEMBER_COVERAGE_NOTE}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- banner */

function MemberCoverageBanner({
  coverage,
  isScanning,
  progress,
  onStart,
  failures,
}: {
  coverage: MemberCoverage;
  isScanning: boolean;
  progress: { completed: number; total: number } | null;
  onStart: () => void;
  failures: { workspaceName: string; message: string }[];
}) {
  if (coverage.mode === "full" && failures.length === 0) {
    return (
      <div className="ha-card flex flex-wrap items-center gap-3 border-[color:rgba(5,150,105,0.28)] bg-[color:var(--success-soft)] px-4 py-3">
        <span className="text-[color:var(--success)]">
          <Icon name="badgeCheck" size={16} />
        </span>
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-[color:var(--foreground)]">
          Member analytics cover all {coverage.workspacesCovered.toLocaleString()} workspaces.
        </p>
      </div>
    );
  }

  const tone =
    failures.length > 0
      ? { border: "rgba(180,83,9,0.3)", background: "var(--warning-soft)", color: "var(--warning)" }
      : { border: "var(--border)", background: "var(--card)", color: "var(--info)" };

  return (
    <div
      className="ha-card flex flex-wrap items-start gap-3 px-4 py-3"
      style={{ borderColor: tone.border, background: tone.background }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: tone.color }}>
        <Icon name={failures.length > 0 ? "alert" : "scan"} size={16} />
      </span>

      {/* basis-64 rather than a bare flex-1: without a floor the text column
          shrinks to a few characters per line instead of wrapping the button. */}
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-[0.8125rem] font-medium text-[color:var(--foreground)]">
          {failures.length > 0
            ? `Member scan completed with ${failures.length} failure${failures.length === 1 ? "" : "s"}`
            : coverage.mode === "scoped"
              ? `Member figures cover one workspace: “${coverage.scopeLabel}”`
              : "Member figures are unavailable"}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[color:var(--text-muted)]">
          {failures.length > 0
            ? `Covered ${coverage.workspacesCovered} of ${coverage.workspacesTotal} workspaces. ${failures
                .slice(0, 3)
                .map((failure) => `${failure.workspaceName}: ${failure.message}`)
                .join(" · ")}`
            : `${MEMBER_COVERAGE_NOTE} Run a scan to extend invitations, roles, revocations, and joins to all ${coverage.workspacesTotal.toLocaleString()} workspaces.`}
        </p>
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={isScanning}
        className="ha-btn ha-btn-secondary ha-btn-sm shrink-0"
      >
        <Icon name="scan" size={13} className={isScanning ? "animate-pulse" : undefined} />
        {isScanning && progress ? `Scanning ${progress.completed}/${progress.total}` : "Scan all workspaces"}
      </button>
    </div>
  );
}
