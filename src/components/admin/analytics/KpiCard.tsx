"use client";

import { Sparkline } from "@/components/charts/Sparkline";
import { categoricalColor, statusPalette } from "@/components/charts/palette";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { Analytic } from "@/lib/admin/analytics/metrics";

/**
 * Executive stat tile.
 *
 * Contract: label · value · optional delta vs a named period · optional
 * sparkline. Values use proportional figures (tabular figures make a standalone
 * number look loose at display size); only columns get `tabular-nums`.
 *
 * An `unavailable` metric renders the word "Unavailable" plus the actual reason.
 * It never falls back to zero — a zero would be read as a measurement.
 */

export type KpiDelta = {
  /** Records added inside the selected range. */
  change: number;
  /** Change in additions vs the equally sized prior window; null when not comparable. */
  percent: number | null;
  /** e.g. "the last 30 days" — completes the sentence "N added in …". */
  periodLabel: string;
};

type KpiCardProps = {
  label: string;
  metric: Analytic;
  icon: IconName;
  /** Explains what the figure counts; surfaced as a title tooltip. */
  description?: string;
  delta?: KpiDelta | null;
  trend?: number[];
  /** Held at reduced opacity during a refresh rather than swapped for a skeleton. */
  isStale?: boolean;
  isLoading?: boolean;
};

export function KpiCard({
  label,
  metric,
  icon,
  description,
  delta = null,
  trend,
  isStale = false,
  isLoading = false,
}: KpiCardProps) {
  const isUnavailable = metric.state === "unavailable";
  const isEmpty = metric.state === "ready" && metric.value === 0;

  const deltaTone =
    delta === null || delta.change === 0
      ? "neutral"
      : delta.change > 0
        ? "up"
        : "down";

  return (
    <article
      className="ha-card ha-card-interactive flex flex-col p-5"
      aria-busy={isLoading || undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8125rem] font-medium text-[color:var(--text-muted)]" title={description}>
          {label}
        </p>
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={
            isUnavailable
              ? { background: "var(--muted)", color: "var(--text-subtle)" }
              : { background: "var(--accent-soft)", color: "var(--accent)" }
          }
        >
          <Icon name={isUnavailable ? "lock" : icon} size={16} />
        </span>
      </div>

      <div className={`mt-4 flex flex-1 items-end justify-between gap-3 transition-opacity ${isStale ? "opacity-60" : ""}`}>
        <div className="min-w-0">
          {isLoading ? (
            <>
              <div className="ha-skeleton h-8 w-20" />
              <div className="ha-skeleton mt-2 h-3 w-28" />
            </>
          ) : isUnavailable ? (
            <>
              <p className="text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--text-subtle)]">
                Unavailable
              </p>
              <p className="mt-1.5 max-w-[22rem] text-xs leading-relaxed text-[color:var(--text-subtle)]">
                {metric.reason}
              </p>
            </>
          ) : (
            <>
              <p
                className={`ha-metric-value ${isEmpty ? "text-[color:var(--text-subtle)]" : ""}`}
                style={{ fontVariantNumeric: "normal" }}
              >
                {metric.value.toLocaleString()}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {delta ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium"
                    title={`${delta.change.toLocaleString()} added in ${delta.periodLabel}${
                      delta.percent !== null ? `, ${delta.percent > 0 ? "up" : "down"} ${Math.abs(delta.percent)}% versus the prior period` : ""
                    }`}
                    style={{
                      color:
                        deltaTone === "up"
                          ? statusPalette.good
                          : deltaTone === "down"
                            ? statusPalette.critical
                            : "var(--text-subtle)",
                    }}
                  >
                    <Icon
                      aria-hidden="true"
                      name={deltaTone === "up" ? "trendUp" : deltaTone === "down" ? "trendDown" : "minus"}
                      size={12}
                    />
                    {delta.change > 0 ? "+" : ""}
                    {delta.change.toLocaleString()}
                    {delta.percent !== null ? ` (${delta.percent > 0 ? "+" : ""}${delta.percent}%)` : ""}
                    <span className="sr-only">
                      {` added in ${delta.periodLabel}`}
                      {delta.percent !== null ? `, ${delta.percent > 0 ? "up" : "down"} ${Math.abs(delta.percent)} percent versus the prior period` : ""}
                    </span>
                  </span>
                ) : null}
                {metric.hint ? (
                  <span className="text-xs text-[color:var(--text-muted)]">{metric.hint}</span>
                ) : null}
              </div>
            </>
          )}
        </div>

        {!isUnavailable && !isLoading && trend && trend.length > 1 ? (
          <div className="shrink-0 pb-1">
            <Sparkline values={trend} color={categoricalColor(0)} />
          </div>
        ) : null}
      </div>
    </article>
  );
}
