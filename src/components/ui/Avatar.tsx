import { getInitials } from "@/lib/admin/users";

const sizeMap = {
  sm: { box: "h-8 w-8", text: "text-[0.6875rem]" },
  md: { box: "h-10 w-10", text: "text-sm" },
  lg: { box: "h-14 w-14", text: "text-lg" },
} as const;

export type AvatarSize = keyof typeof sizeMap;

/**
 * Initials avatar. The backend stores no profile images, so initials are the
 * complete representation rather than a placeholder for a missing photo.
 */
export function Avatar({
  name,
  size = "md",
  tone = "accent",
  className = "",
}: {
  name: string;
  size?: AvatarSize;
  tone?: "accent" | "neutral";
  className?: string;
}) {
  const dimensions = sizeMap[size];
  const palette =
    tone === "accent"
      ? { background: "var(--accent)", color: "#ffffff" }
      : { background: "var(--muted)", color: "var(--text-muted)" };

  return (
    <span
      aria-hidden="true"
      style={palette}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${dimensions.box} ${dimensions.text} ${className}`}
    >
      {getInitials(name)}
    </span>
  );
}
