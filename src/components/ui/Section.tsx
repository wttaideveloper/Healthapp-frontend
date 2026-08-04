import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";

type SectionCardProps = {
  title: string;
  description?: string;
  icon?: IconName;
  /** Rendered on the right of the header — actions, badges, filters. */
  action?: ReactNode;
  /** Removes the default body padding for flush content such as tables. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
};

export function SectionCard({
  title,
  description,
  icon,
  action,
  flush = false,
  className = "",
  children,
}: SectionCardProps) {
  return (
    <section className={`ha-card ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[color:var(--border)] px-5 py-4">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon ? (
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--muted)] text-[color:var(--text-muted)]">
              <Icon name={icon} size={15} />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="ha-section-title">{title}</h2>
            {description ? <p className="ha-section-subtitle">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

type EmptyStateProps = {
  icon?: IconName;
  title: string;
  description?: string;
  /** Optional footnote — used to surface missing-backend context. */
  note?: string;
  action?: ReactNode;
};

export function EmptyState({ icon = "inbox", title, description, note, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--muted)] text-[color:var(--text-subtle)]">
        <Icon name={icon} size={20} />
      </span>
      <p className="mt-3.5 text-sm font-semibold text-[color:var(--foreground)]">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[0.8125rem] leading-relaxed text-[color:var(--text-muted)]">{description}</p>
      ) : null}
      {note ? (
        <p className="mt-3 max-w-sm rounded-lg bg-[color:var(--muted)] px-3 py-2 text-xs leading-relaxed text-[color:var(--text-subtle)]">
          {note}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
