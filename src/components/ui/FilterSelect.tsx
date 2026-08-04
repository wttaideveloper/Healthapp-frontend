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
        className={`ha-input w-auto py-1.5 text-xs ${className}`}
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
