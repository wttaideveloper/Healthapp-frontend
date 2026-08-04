import { Icon, type IconName } from "@/components/ui/Icon";

export type TimelineItem = {
  id: string;
  icon: IconName;
  tone: "accent" | "info" | "warning" | "neutral";
  title: string;
  detail: string | null;
  /** ISO string used for the `<time datetime>` attribute. */
  timestamp: string;
  /** Preformatted, human-readable time shown to the right. */
  displayTime: string;
};

const toneStyles: Record<TimelineItem["tone"], { bg: string; fg: string }> = {
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  info: { bg: "var(--info-soft)", fg: "var(--info)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
  neutral: { bg: "var(--muted)", fg: "var(--text-muted)" },
};

/**
 * Vertical event list with a connecting rail.
 *
 * Rendered as an ordered list so screen readers announce sequence; the rail
 * itself is decorative and hidden from assistive tech.
 */
export function Timeline({ items, label }: { items: TimelineItem[]; label: string }) {
  if (items.length === 0) return null;

  return (
    <ol aria-label={label} className="relative space-y-0">
      {items.map((item, index) => {
        const palette = toneStyles[item.tone];
        const isLast = index === items.length - 1;

        return (
          <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span aria-hidden="true" className="absolute left-2.75 top-6 bottom-0 w-px bg-border" />
            ) : null}

            <span
              aria-hidden="true"
              style={{ background: palette.bg, color: palette.fg }}
              className="relative z-10 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full ring-4 ring-card"
            >
              <Icon name={item.icon} size={11} strokeWidth={2.25} />
            </span>

            <div className="-mt-0.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-[0.8125rem] font-medium text-foreground">{item.title}</p>
                <time dateTime={item.timestamp} className="shrink-0 text-xs tabular-nums text-text-subtle">
                  {item.displayTime}
                </time>
              </div>
              {item.detail ? <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{item.detail}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
