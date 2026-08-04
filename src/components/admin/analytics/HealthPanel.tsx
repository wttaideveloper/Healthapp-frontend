"use client";

import { useState } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionCard } from "@/components/ui/Section";
import type { HealthRow, HealthTone } from "@/lib/admin/analytics/metrics";

/**
 * System health signals.
 *
 * Every row is a named condition with an explicit definition, a status badge,
 * and — where names exist behind the number — a collapsible list of them. Status
 * colour is never the only cue: each badge carries an icon and a word.
 */

const toneBadge: Record<HealthTone, { className: string; icon: IconName }> = {
  good: { className: "ha-badge-success", icon: "check" },
  warning: { className: "ha-badge-warning", icon: "alert" },
  critical: { className: "ha-badge-danger", icon: "alert" },
  neutral: { className: "ha-badge-neutral", icon: "minus" },
};

/**
 * A signal's colour depends on whether its count is the good direction.
 * "Healthy Workspaces" is good when high; "Expired Workspaces" is good when
 * zero. Reading `row.tone` straight through would paint "0 expired" red.
 */
function resolveTone(row: HealthRow): HealthTone {
  if (row.metric.state === "unavailable") return "neutral";
  const isCountGood = row.tone === "good";
  if (isCountGood) return row.metric.value > 0 ? "good" : "warning";
  return row.metric.value > 0 ? row.tone : "good";
}

function HealthItem({ row }: { row: HealthRow }) {
  const [isOpen, setIsOpen] = useState(false);

  const isUnavailable = row.metric.state === "unavailable";
  const count = row.metric.value;
  const badge = toneBadge[resolveTone(row)];
  const canExpand = !isUnavailable && row.samples.length > 0;

  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.8125rem] font-medium text-[color:var(--foreground)]">{row.label}</p>
            {/* Icon + number, never colour alone. */}
            <span className={`ha-badge ${badge.className}`}>
              <Icon name={badge.icon} size={11} />
              {isUnavailable ? "Unavailable" : count.toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--text-muted)]">
            {isUnavailable ? row.metric.reason : row.description}
          </p>
          {!isUnavailable && row.metric.hint ? (
            <p className="mt-0.5 text-xs text-[color:var(--text-subtle)]">{row.metric.hint}</p>
          ) : null}
        </div>

        {canExpand ? (
          <button
            type="button"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
            className="ha-btn ha-btn-ghost ha-btn-sm shrink-0"
          >
            {isOpen ? "Hide" : "View"}
            <Icon name="chevronDown" size={12} className={isOpen ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        ) : null}
      </div>

      {canExpand && isOpen ? (
        <ul className="ha-scroll mt-2.5 max-h-40 space-y-1 overflow-auto rounded-lg bg-[color:var(--muted)] px-3 py-2">
          {row.samples.map((sample) => (
            <li key={sample} className="truncate text-xs text-[color:var(--text-muted)]">
              {sample}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function HealthPanel({ rows }: { rows: HealthRow[] }) {
  const attention = rows.filter(
    (row) => row.metric.state === "ready" && row.metric.value > 0 && (row.tone === "warning" || row.tone === "critical"),
  ).length;

  return (
    <SectionCard
      title="System Health"
      description="Named conditions computed from workspace, subscription, and member records"
      icon="gauge"
      flush
      action={
        <span className={`ha-badge ${attention > 0 ? "ha-badge-warning" : "ha-badge-success"}`}>
          <Icon name={attention > 0 ? "alert" : "check"} size={11} />
          {attention > 0 ? `${attention} need${attention === 1 ? "s" : ""} attention` : "All clear"}
        </span>
      }
    >
      <ul className="divide-y divide-[color:var(--border)]">
        {rows.map((row) => (
          <HealthItem key={row.key} row={row} />
        ))}
      </ul>
    </SectionCard>
  );
}
