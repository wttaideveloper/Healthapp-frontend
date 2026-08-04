import { Icon, type IconName } from "@/components/ui/Icon";

export type MetricState = "loading" | "ready" | "error" | "unavailable";

export type MetricTone = "accent" | "info" | "warning" | "neutral";

const toneStyles: Record<MetricTone, { bg: string; fg: string }> = {
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  info: { bg: "var(--info-soft)", fg: "var(--info)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
  neutral: { bg: "var(--muted)", fg: "var(--text-muted)" },
};

type MetricCardProps = {
  label: string;
  value: number;
  /** Icon rendered in the tinted badge. Falls back to a neutral grid glyph. */
  icon?: IconName;
  tone?: MetricTone;
  /** Short clarifying line under the value (e.g. the scope the number covers). */
  hint?: string;
  state?: MetricState;
  /** Message shown for the `error` state. */
  errorMessage?: string;
  /** Message shown for the `unavailable` state (e.g. missing backend endpoint). */
  unavailableMessage?: string;
  /** Copy shown when the metric resolved to zero. */
  emptyMessage?: string;
};

export function MetricCard({
  label,
  value,
  icon = "grid",
  tone = "accent",
  hint,
  state = "ready",
  errorMessage = "Could not load",
  unavailableMessage = "Not available",
  emptyMessage,
}: MetricCardProps) {
  const palette = toneStyles[tone];
  const isEmpty = state === "ready" && value === 0;

  return (
    <article className="ha-card ha-card-interactive p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8125rem] font-medium text-[color:var(--text-muted)]">{label}</p>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: palette.bg, color: palette.fg }}
        >
          <Icon name={state === "unavailable" ? "lock" : state === "error" ? "alert" : icon} size={16} />
        </span>
      </div>

      <div className="mt-4 min-h-[2.75rem]">
        {state === "loading" ? (
          <>
            <div className="ha-skeleton h-8 w-20" />
            <div className="ha-skeleton mt-2 h-3 w-28" />
          </>
        ) : null}

        {state === "error" ? (
          <>
            <p className="ha-metric-value text-[color:var(--text-subtle)]">—</p>
            <p className="mt-1.5 text-xs text-[color:var(--danger)]">{errorMessage}</p>
          </>
        ) : null}

        {state === "unavailable" ? (
          <>
            <p className="ha-metric-value text-[color:var(--text-subtle)]">—</p>
            <p className="mt-1.5 text-xs text-[color:var(--text-subtle)]">{unavailableMessage}</p>
          </>
        ) : null}

        {state === "ready" ? (
          <>
            <p className={`ha-metric-value ${isEmpty ? "text-[color:var(--text-subtle)]" : ""}`}>
              {value.toLocaleString()}
            </p>
            {isEmpty && emptyMessage ? (
              <p className="mt-1.5 text-xs text-[color:var(--text-subtle)]">{emptyMessage}</p>
            ) : hint ? (
              <p className="mt-1.5 text-xs text-[color:var(--text-muted)]">{hint}</p>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}
