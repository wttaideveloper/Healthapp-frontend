"use client";

import { Icon } from "@/components/ui/Icon";
import { pageSizeOptions, type PageSize } from "@/lib/admin/users";

type PaginationProps = {
  page: number;
  pageCount: number;
  pageSize: PageSize;
  from: number;
  to: number;
  total: number;
  /** Noun for the summary line, e.g. "user". Pluralized with a trailing "s". */
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
};

export function Pagination({
  page,
  pageCount,
  pageSize,
  from,
  to,
  total,
  itemLabel = "item",
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const isFirst = page <= 1;
  const isLast = page >= pageCount;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] px-5 py-3"
    >
      <p aria-live="polite" className="text-xs text-[color:var(--text-muted)]">
        {total === 0 ? (
          `No ${itemLabel}s`
        ) : (
          <>
            Showing <span className="font-medium tabular-nums text-[color:var(--foreground)]">{from}</span>–
            <span className="font-medium tabular-nums text-[color:var(--foreground)]">{to}</span> of{" "}
            <span className="font-medium tabular-nums text-[color:var(--foreground)]">{total}</span> {itemLabel}
            {total === 1 ? "" : "s"}
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="page-size" className="text-xs text-[color:var(--text-muted)]">
            Rows
          </label>
          <select
            id="page-size"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSize)}
            className="ha-input w-auto py-1 pr-7 text-xs"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={isFirst}
            aria-label="First page"
            className="ha-btn ha-btn-secondary ha-btn-sm"
          >
            <Icon name="chevronsLeft" size={13} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={isFirst}
            aria-label="Previous page"
            className="ha-btn ha-btn-secondary ha-btn-sm"
          >
            <Icon name="chevronLeft" size={13} />
          </button>

          <span className="px-2 text-xs tabular-nums text-[color:var(--text-muted)]">
            Page <span className="font-medium text-[color:var(--foreground)]">{page}</span> of {pageCount}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={isLast}
            aria-label="Next page"
            className="ha-btn ha-btn-secondary ha-btn-sm"
          >
            <Icon name="chevronRight" size={13} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(pageCount)}
            disabled={isLast}
            aria-label="Last page"
            className="ha-btn ha-btn-secondary ha-btn-sm"
          >
            <Icon name="chevronsRight" size={13} />
          </button>
        </div>
      </div>
    </nav>
  );
}
