"use client";

import { statusPalette } from "@/components/charts/palette";
import { Icon, type IconName } from "@/components/ui/Icon";
import { EmptyState, SectionCard } from "@/components/ui/Section";
import type { HealthTone, QuickInsight } from "@/lib/admin/analytics/metrics";

/**
 * Plain-language summary cards.
 *
 * Every statement restates a figure computed elsewhere on this page; none is
 * generated for a metric that could not be derived. The "derived from" line is
 * always shown so a reader can trace any claim back to the record field it came
 * from — an unexplained sentence would be indistinguishable from an invented one.
 */

const toneStyle: Record<HealthTone, { color: string; background: string; icon: IconName }> = {
  good: { color: statusPalette.good, background: "var(--success-soft)", icon: "check" },
  warning: { color: statusPalette.warning, background: "var(--warning-soft)", icon: "alert" },
  critical: { color: statusPalette.critical, background: "var(--danger-soft)", icon: "alert" },
  neutral: { color: statusPalette.neutral, background: "var(--muted)", icon: "sparkles" },
};

export function QuickInsights({ insights }: { insights: QuickInsight[] }) {
  return (
    <SectionCard
      title="Quick Insights"
      description="Generated from the figures above — nothing is estimated"
      icon="sparkles"
    >
      {insights.length === 0 ? (
        <EmptyState
          icon="sparkles"
          title="No insights yet"
          description="Insights appear once workspaces, subscriptions, or members produce a figure worth calling out."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {insights.map((insight) => {
            const style = toneStyle[insight.tone];
            return (
              <li
                key={insight.key}
                className="flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card-2)] p-3.5"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: style.background, color: style.color }}
                >
                  <Icon name={style.icon} size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-medium leading-snug text-[color:var(--foreground)]">
                    {insight.message}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[color:var(--text-subtle)]">
                    Derived from: {insight.basis}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
