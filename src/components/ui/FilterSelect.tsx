export type FilterOption<T extends string> = {
  value: T;
  label: string;
};

type FilterSelectProps<T extends string> = {
  id: string;
  /** Visually hidden but announced — these selects sit in a dense toolbar. */
  label: string;
  value: T;
  options: ReadonlyArray<FilterOption<T>>;
  onChange: (value: T) => void;
  className?: string;
};

/**
 * Compact toolbar select used by every directory view's filter bar.
 * Keeps label association and sizing consistent across Users and Workspaces.
 */
export function FilterSelect<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  className = "",
}: FilterSelectProps<T>) {
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value as T)}
        /**
         * `width: auto` is set inline, not via the `w-auto` utility.
         * `.ha-input` declares `width: 100%` in globals.css outside any cascade
         * layer, and unlayered rules beat Tailwind's layered utilities no matter
         * their specificity — so `w-auto` never applied and every toolbar select
         * stretched to its container, one per row. Inline style is the smallest
         * fix that restores the intended compact sizing without editing the
         * shared `.ha-input` rule that inputs elsewhere depend on.
         */
        style={{ width: "auto" }}
        className={`ha-input w-auto max-w-full py-1.5 text-xs ${className}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
