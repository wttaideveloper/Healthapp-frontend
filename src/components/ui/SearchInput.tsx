"use client";

import { useRef } from "react";

import { Icon } from "@/components/ui/Icon";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name — required because the control has no visible label. */
  label: string;
  /** Announced to screen readers as results narrow. */
  resultsLabel?: string;
  className?: string;
};

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  label,
  resultsLabel,
  className = "",
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-subtle)]">
        <Icon name="search" size={15} />
      </span>

      <input
        ref={inputRef}
        type="search"
        role="searchbox"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Escape clears without blurring, matching common SaaS table search.
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
        className="ha-input pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none"
      />

      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[color:var(--text-subtle)] transition-colors hover:bg-[color:var(--muted)] hover:text-[color:var(--foreground)] focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
        >
          <Icon name="x" size={13} />
        </button>
      ) : null}

      {resultsLabel ? (
        <span aria-live="polite" className="sr-only">
          {resultsLabel}
        </span>
      ) : null}
    </div>
  );
}
