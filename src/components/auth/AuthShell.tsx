import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";

/**
 * Shared frame for every unauthenticated screen.
 *
 * The three auth surfaces previously each invented their own container, radius
 * and type scale; this is the single frame they now share, so sign-in, sign-up
 * and password reset read as one product.
 *
 * Layout: a centred column that never exceeds a comfortable measure, full-bleed
 * on phones and a floating card from `sm` up.
 */

type AuthShellProps = {
  title: string;
  subtitle?: string;
  /** Small label above the title, e.g. the console name. */
  eyebrow?: string;
  children: ReactNode;
  /** Secondary links rendered under the card. */
  footer?: ReactNode;
};

export function AuthShell({ title, subtitle, eyebrow, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-[26rem]">
        {/* Brand */}
        <div className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] bg-[color:var(--accent)] text-white shadow-[var(--shadow-sm)]"
          >
            <Icon name="shield" size={19} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.9375rem] font-semibold leading-tight tracking-[-0.012em]">HealthAge</p>
            <p className="text-xs leading-tight text-[color:var(--text-subtle)]">Admin Console</p>
          </div>
        </div>

        <section className="ha-card ha-enter p-6 shadow-[var(--shadow-sm)] sm:p-7">
          {eyebrow ? <p className="ha-eyebrow mb-2">{eyebrow}</p> : null}
          <h1 className="text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-[color:var(--foreground)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-[color:var(--text-muted)]">{subtitle}</p>
          ) : null}

          <div className="mt-6">{children}</div>
        </section>

        {footer ? (
          <div className="mt-5 space-y-1.5 text-center text-[0.8125rem] text-[color:var(--text-muted)]">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}

/** Inline link styled consistently across the auth screens. */
export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="font-medium text-[color:var(--accent)] underline-offset-4 transition-colors hover:text-[color:var(--accent-hover)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
    >
      {children}
    </a>
  );
}
