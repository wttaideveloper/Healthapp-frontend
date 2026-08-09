import { Icon } from "@/components/ui/Icon";
import { ToastType } from "@/types/admin";

export function ToastMessage({
  type,
  message,
  description,
}: {
  type: ToastType;
  message: string;
  /** Optional second line, rendered muted under the headline. */
  description?: string;
}) {
  const isSuccess = type === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      className="ha-toast ha-card fixed right-4 top-4 z-50 flex max-w-sm items-start gap-2.5 px-4 py-3 shadow-[var(--shadow-lg)]"
    >
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{
          background: isSuccess ? "var(--success-soft)" : "var(--danger-soft)",
          color: isSuccess ? "var(--success)" : "var(--danger)",
        }}
      >
        <Icon name={isSuccess ? "check" : "alert"} size={12} strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.8125rem] leading-relaxed text-[color:var(--foreground)]">{message}</p>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--text-muted)]">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
