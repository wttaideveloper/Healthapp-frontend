import { Icon } from "@/components/ui/Icon";
import type { SeatUsage } from "@/lib/admin/workspaces";

/**
 * Seat utilization meter.
 *
 * Colour encodes pressure, not just progress: comfortable below 75%, warning as
 * the workspace approaches its limit, danger at or beyond capacity.
 */
function toneFor(usage: SeatUsage): { fill: string; text: string } {
  if (usage.isOverCapacity) return { fill: "var(--danger)", text: "var(--danger)" };
  if (usage.isFull) return { fill: "var(--danger)", text: "var(--danger)" };
  if (usage.percent >= 75) return { fill: "var(--warning)", text: "var(--warning)" };
  return { fill: "var(--accent)", text: "var(--text-muted)" };
}

type SeatUsageBarProps = {
  usage: SeatUsage;
  /** Adds the "N / M seats used" caption and remaining-seat line. */
  showCaption?: boolean;
  /** Accessible context, e.g. the workspace name. */
  label?: string;
  className?: string;
};

export function SeatUsageBar({ usage, showCaption = false, label, className = "" }: SeatUsageBarProps) {
  if (usage.isUnlimited) {
    return (
      <div className={className}>
        <span className="ha-badge ha-badge-info">
          <Icon name="badgeCheck" size={11} />
          Unlimited seats
        </span>
        {showCaption ? (
          <p className="mt-1.5 text-xs text-[color:var(--text-muted)]">
            {usage.used.toLocaleString()} {usage.used === 1 ? "seat" : "seats"} in use
          </p>
        ) : null}
      </div>
    );
  }

  const tone = toneFor(usage);
  const limit = usage.limit ?? 0;
  const valueText = `${usage.used} of ${limit} seats used, ${usage.percent}%`;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <div
          role="progressbar"
          aria-valuenow={usage.used}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuetext={valueText}
          aria-label={label ? `Seat usage for ${label}` : "Seat usage"}
          className="h-1.5 min-w-[3.5rem] flex-1 overflow-hidden rounded-full bg-[color:var(--muted)]"
        >
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(usage.percent, usage.used > 0 ? 4 : 0)}%`, background: tone.fill }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums" style={{ color: tone.text }}>
          {usage.used}/{limit}
        </span>
      </div>

      {showCaption ? (
        <p className="mt-1.5 text-xs text-[color:var(--text-muted)]">
          {usage.isOverCapacity ? (
            <span className="font-medium text-[color:var(--danger)]">
              {usage.used - limit} over capacity ({usage.percent}%)
            </span>
          ) : usage.isFull ? (
            <span className="font-medium text-[color:var(--danger)]">All seats in use (100%)</span>
          ) : (
            <>
              {usage.percent}% used · <span className="font-medium">{usage.available}</span>{" "}
              {usage.available === 1 ? "seat" : "seats"} available
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}
