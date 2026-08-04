"use client";

import { useCallback, useRef } from "react";

import { Icon } from "@/components/ui/Icon";
import { rangeOptions, type RangeKey } from "@/lib/admin/analytics/range";

/**
 * The single filter row that scopes everything below it.
 *
 * One row, above the content — never a per-chart filter. The range is a roving
 * tabindex radio group so arrow keys move between presets, which is what a
 * segmented control must do to be keyboard-operable.
 */

type AnalyticsToolbarProps = {
  range: RangeKey;
  onRangeChange: (value: RangeKey) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  /** Null hides the export control entirely (unsupported browser or no data). */
  onExport: (() => void) | null;
  memberScan: {
    canScan: boolean;
    isScanning: boolean;
    progress: { completed: number; total: number } | null;
    onStart: () => void;
    onCancel: () => void;
    label: string;
  };
};

export function AnalyticsToolbar({
  range,
  onRangeChange,
  onRefresh,
  isRefreshing,
  onExport,
  memberScan,
}: AnalyticsToolbarProps) {
  const groupRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();

      const currentIndex = rangeOptions.findIndex((option) => option.value === range);
      const lastIndex = rangeOptions.length - 1;
      const nextIndex =
        event.key === "ArrowRight"
          ? Math.min(lastIndex, currentIndex + 1)
          : event.key === "ArrowLeft"
            ? Math.max(0, currentIndex - 1)
            : event.key === "Home"
              ? 0
              : lastIndex;

      onRangeChange(rangeOptions[nextIndex].value);
      const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>("[role='radio']");
      buttons?.[nextIndex]?.focus();
    },
    [range, onRangeChange],
  );

  return (
    <div className="ha-card flex flex-wrap items-center gap-3 p-3">
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Analytics date range"
        onKeyDown={handleKeyDown}
        className="flex items-center gap-1 rounded-lg bg-[color:var(--muted)] p-1"
      >
        {rangeOptions.map((option) => {
          const isActive = option.value === range;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onRangeChange(option.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] ${
                isActive
                  ? "bg-[color:var(--card)] text-[color:var(--foreground)] shadow-[var(--shadow-xs)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--foreground)]"
              }`}
            >
              <span className="sm:hidden">{option.short}</span>
              <span className="hidden sm:inline">{option.label}</span>
            </button>
          );
        })}
      </div>

      <p className="hidden min-w-0 flex-1 text-xs leading-relaxed text-[color:var(--text-subtle)] lg:block">
        Range scopes growth, trends, and recent activity. Totals, seats, and health reflect current state.
      </p>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {memberScan.canScan ? (
          memberScan.isScanning ? (
            <button type="button" onClick={memberScan.onCancel} className="ha-btn ha-btn-secondary ha-btn-sm">
              <Icon name="x" size={13} />
              {memberScan.progress
                ? `Cancel (${memberScan.progress.completed}/${memberScan.progress.total})`
                : "Cancel scan"}
            </button>
          ) : (
            <button
              type="button"
              onClick={memberScan.onStart}
              className="ha-btn ha-btn-secondary ha-btn-sm"
              title={memberScan.label}
            >
              <Icon name="scan" size={13} />
              {memberScan.label}
            </button>
          )
        ) : null}

        {onExport ? (
          <button type="button" onClick={onExport} className="ha-btn ha-btn-secondary ha-btn-sm">
            <Icon name="download" size={13} />
            Export CSV
          </button>
        ) : null}

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="ha-btn ha-btn-secondary ha-btn-sm"
        >
          <Icon name="refresh" size={13} className={isRefreshing ? "animate-spin" : undefined} />
          Refresh
        </button>
      </div>

      <p className="w-full text-xs leading-relaxed text-[color:var(--text-subtle)] lg:hidden">
        Range scopes growth, trends, and recent activity. Totals, seats, and health reflect current state.
      </p>
    </div>
  );
}
