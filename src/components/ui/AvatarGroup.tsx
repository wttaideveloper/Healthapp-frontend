import { getInitials } from "@/lib/admin/users";

type AvatarGroupEntry = {
  id: string;
  /** Falls back to the email local-part when no account name is known. */
  label: string;
  /** Owners get the accent treatment so they read as distinct at a glance. */
  emphasis?: boolean;
  muted?: boolean;
};

type AvatarGroupProps = {
  entries: AvatarGroupEntry[];
  max?: number;
  /** Accessible summary, e.g. "5 members in Clinic ABC". */
  label: string;
  className?: string;
};

/**
 * Overlapping initials avatars with a "+N" overflow chip.
 *
 * Decorative by design: the individual circles are hidden from assistive tech
 * and a single summary label carries the meaning.
 */
export function AvatarGroup({ entries, max = 4, label, className = "" }: AvatarGroupProps) {
  if (entries.length === 0) return null;

  const visible = entries.slice(0, max);
  const overflow = entries.length - visible.length;

  return (
    <div className={`flex items-center ${className}`}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex -space-x-1.5">
        {visible.map((entry) => (
          <span
            key={entry.id}
            title={entry.label}
            style={{
              background: entry.emphasis ? "var(--accent)" : entry.muted ? "var(--muted)" : "var(--card-2)",
              color: entry.emphasis ? "#ffffff" : "var(--text-muted)",
              borderColor: "var(--card)",
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[0.5625rem] font-semibold"
          >
            {getInitials(entry.label)}
          </span>
        ))}
        {overflow > 0 ? (
          <span
            style={{ borderColor: "var(--card)" }}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 bg-[color:var(--muted)] text-[0.5625rem] font-semibold text-[color:var(--text-muted)]"
          >
            +{overflow}
          </span>
        ) : null}
      </div>
    </div>
  );
}
