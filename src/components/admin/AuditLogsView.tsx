"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import { AuditLogDetailDrawer } from "@/components/admin/AuditLogDetailDrawer";
import { FilterSelect, type FilterOption } from "@/components/ui/FilterSelect";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState, SectionCard } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { callApi } from "@/lib/admin/api";
import { buildCsv, canExportCsv, csvFilename, downloadCsv } from "@/lib/admin/analytics/csv";
import { rangeOptions, type RangeKey } from "@/lib/admin/analytics/range";
import {
  auditActionIcon,
  auditActionLabel,
  auditActorLabel,
  auditResourceLabel,
  auditSortOptions,
  buildAuditCsvSection,
  buildAuditFilterOptions,
  countActiveAuditFilters,
  defaultAuditFilters,
  filterAuditLogs,
  isAuditSortKey,
  isSystemActor,
  sortAuditLogs,
  type AuditFilterState,
  type AuditResultFilter,
  type AuditSortKey,
} from "@/lib/admin/audit";
import { copyToClipboard } from "@/lib/admin/clipboard";
import { formatRelativeTime } from "@/lib/admin/activity";
import { isPageSize, paginate, type PageSize } from "@/lib/admin/users";
import { tokenStorageKey } from "@/lib/admin/storage";
import { formatDateTime } from "@/lib/format";
import type { AuditLog } from "@/types/admin";

/**
 * Audit Logs.
 *
 * Answers who did what, when, and to which resource. Every row is a real event
 * written by the backend at the moment the action succeeded (or, for admin sign-in,
 * failed) — nothing here is derived, inferred, or backfilled.
 *
 * Loads lazily on first open rather than with the rest of the dashboard: an
 * administrator who never opens this tab never pays for the query.
 *
 * Search, filter, sort, and pagination are client-side over the loaded window,
 * matching the Users and Workspaces views. All the chrome — search box, filter
 * selects, pagination, drawer, badges — is the existing shared component library.
 */

const SORT_STORAGE_KEY = "healthage.admin.audit.sort";
const PAGE_SIZE_STORAGE_KEY = "healthage.admin.audit.pageSize";

/** Matches the backend's default window. Surfaced in the UI so the scope is honest. */
const LOADED_WINDOW = 500;

const resultFilterOptions: ReadonlyArray<FilterOption<AuditResultFilter>> = [
  { value: "all", label: "All results" },
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
];

const rangeFilterOptions: ReadonlyArray<FilterOption<RangeKey>> = rangeOptions.map((option) => ({
  value: option.value,
  label: option.label,
}));

type AuditLogsViewProps = {
  onNotify: (type: "success" | "error", message: string) => void;
};

export function AuditLogsView({ onNotify }: AuditLogsViewProps) {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const [filters, setFilters] = useState<AuditFilterState>(defaultAuditFilters);
  const [sortKey, setSortKey] = useLocalStorageState<AuditSortKey>(
    SORT_STORAGE_KEY,
    "newest",
    isAuditSortKey,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useLocalStorageState<PageSize>(PAGE_SIZE_STORAGE_KEY, 25, isPageSize);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /**
   * Frozen per load, not read per render: the date-range filter must not
   * re-evaluate mid-interaction, and a moving clock would invalidate the memo on
   * every keystroke.
   */
  const [now, setNow] = useState<number | null>(null);

  const loadLogs = useCallback(async () => {
    const token = typeof window === "undefined" ? null : window.localStorage.getItem(tokenStorageKey);
    if (!token) {
      setLoadError("Session token unavailable. Sign in again to view audit logs.");
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const rows = await callApi<AuditLog[]>(`admin/audit-logs?limit=${LOADED_WINDOW}`, { method: "GET" }, token);
      setLogs(rows);
      setNow(Date.now());
      setLoadedAt(new Date().toISOString());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(
    () => ({ ...filters, search: deferredSearch }),
    [filters, deferredSearch],
  );

  const allLogs = useMemo(() => logs ?? [], [logs]);

  const filterOptions = useMemo(() => buildAuditFilterOptions(allLogs), [allLogs]);

  const filtered = useMemo(
    () => filterAuditLogs(allLogs, effectiveFilters, now ?? Date.now()),
    [allLogs, effectiveFilters, now],
  );
  const sorted = useMemo(() => sortAuditLogs(filtered, sortKey), [filtered, sortKey]);
  const pageData = useMemo(() => paginate(sorted, page, pageSize), [sorted, page, pageSize]);

  const activeFilterCount = useMemo(() => countActiveAuditFilters(effectiveFilters), [effectiveFilters]);

  useEffect(() => {
    if (page !== pageData.page) setPage(pageData.page);
  }, [page, pageData.page]);

  useEffect(() => {
    setPage(1);
  }, [effectiveFilters, sortKey, pageSize]);

  const selectedLog = useMemo(
    () => allLogs.find((log) => log.id === selectedId) ?? null,
    [allLogs, selectedId],
  );

  const actionOptions = useMemo<ReadonlyArray<FilterOption<string>>>(
    () => [
      { value: "all", label: "All actions" },
      ...filterOptions.actions.map((option) => ({
        value: option.value,
        label: `${option.label} (${option.count})`,
      })),
    ],
    [filterOptions.actions],
  );

  const workspaceOptions = useMemo<ReadonlyArray<FilterOption<string>>>(
    () => [
      { value: "all", label: "All workspaces" },
      ...filterOptions.workspaces.map((option) => ({
        value: option.value,
        label: `${option.label} (${option.count})`,
      })),
    ],
    [filterOptions.workspaces],
  );

  const handleCopy = useCallback(
    async (value: string, label: string) => {
      const copied = await copyToClipboard(value);
      onNotify(copied ? "success" : "error", copied ? `${label} copied to clipboard.` : `Could not copy ${label}.`);
    },
    [onNotify],
  );

  /** Exports the rows currently displayed — same filters, same order, all pages. */
  const handleExport = useCallback(() => {
    const succeeded = downloadCsv(
      csvFilename("healthage-audit-log"),
      buildCsv([buildAuditCsvSection(sorted)]),
    );
    onNotify(
      succeeded ? "success" : "error",
      succeeded ? `Exported ${sorted.length} audit events.` : "Could not start the CSV download.",
    );
  }, [sorted, onNotify]);

  const canExport = canExportCsv() && sorted.length > 0;
  const hasLoadedOnce = logs !== null;

  return (
    <div className="space-y-5">
      <SectionCard
        title="Audit Logs"
        description={`Administrative actions recorded by the platform · newest ${LOADED_WINDOW} events`}
        icon="history"
        flush
        action={
          <div className="flex items-center gap-2">
            {loadedAt && !isLoading ? (
              <span className="hidden text-xs text-[color:var(--text-subtle)] sm:inline">
                Updated {new Date(loadedAt).toLocaleTimeString()}
              </span>
            ) : null}
            {canExport ? (
              <button type="button" onClick={handleExport} className="ha-btn ha-btn-secondary ha-btn-sm">
                <Icon name="download" size={13} />
                Export {sorted.length}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={isLoading}
              className="ha-btn ha-btn-secondary ha-btn-sm"
            >
              <Icon name="refresh" size={13} className={isLoading ? "animate-spin" : undefined} />
              Refresh
            </button>
          </div>
        }
      >
        {/* ------------------------------------------------------- toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border)] px-5 py-3">
          <SearchInput
            label="Search audit events by actor, action, workspace, or resource"
            placeholder="Search actor, action, workspace, resource…"
            value={filters.search}
            onChange={(value) => setFilters((current) => ({ ...current, search: value }))}
            resultsLabel={`${sorted.length} events match`}
            className="min-w-[15rem] flex-1"
          />

          <FilterSelect
            id="audit-action-filter"
            label="Filter by action"
            value={filters.action}
            options={actionOptions}
            onChange={(value) => setFilters((current) => ({ ...current, action: value }))}
          />
          <FilterSelect
            id="audit-workspace-filter"
            label="Filter by workspace"
            value={filters.workspaceId}
            options={workspaceOptions}
            onChange={(value) => setFilters((current) => ({ ...current, workspaceId: value }))}
          />
          <FilterSelect
            id="audit-result-filter"
            label="Filter by result"
            value={filters.result}
            options={resultFilterOptions}
            onChange={(value) => setFilters((current) => ({ ...current, result: value }))}
          />
          <FilterSelect
            id="audit-range-filter"
            label="Filter by date range"
            value={filters.range}
            options={rangeFilterOptions}
            onChange={(value) => setFilters((current) => ({ ...current, range: value }))}
          />
          <FilterSelect
            id="audit-sort"
            label="Sort audit events"
            value={sortKey}
            options={auditSortOptions}
            onChange={setSortKey}
          />

          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={() => setFilters(defaultAuditFilters)}
              className="ha-btn ha-btn-ghost ha-btn-sm"
            >
              <Icon name="x" size={12} />
              Clear {activeFilterCount}
            </button>
          ) : null}
        </div>

        {/* --------------------------------------------------------- body */}
        {loadError ? (
          <EmptyState
            icon="alert"
            title="Could not load audit logs"
            description={loadError}
            action={
              <button type="button" onClick={() => void loadLogs()} className="ha-btn ha-btn-secondary ha-btn-sm">
                <Icon name="refresh" size={13} />
                Retry
              </button>
            }
          />
        ) : isLoading && !hasLoadedOnce ? (
          <ul className="divide-y divide-[color:var(--border)]" aria-busy="true">
            {[0, 1, 2, 3, 4].map((row) => (
              <li key={row} className="flex items-center gap-3 px-5 py-3.5">
                <div className="ha-skeleton h-8 w-8 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="ha-skeleton h-3.5 w-1/3" />
                  <div className="ha-skeleton mt-2 h-3 w-1/4" />
                </div>
              </li>
            ))}
            <li className="sr-only">Loading audit events</li>
          </ul>
        ) : allLogs.length === 0 ? (
          <EmptyState
            icon="history"
            title="No audit events recorded yet"
            description="Administrative actions are recorded as they happen. Create a workspace, invite a member, or change a subscription and the event will appear here."
            note="This log starts from the moment audit recording was deployed. Actions taken before that were never recorded and are not reconstructed."
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="search"
            title="No events match these filters"
            description={`${allLogs.length.toLocaleString()} events are loaded, but none match the current search and filters.`}
            action={
              <button
                type="button"
                onClick={() => setFilters(defaultAuditFilters)}
                className="ha-btn ha-btn-secondary ha-btn-sm"
              >
                <Icon name="x" size={13} />
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            <div className="ha-scroll overflow-x-auto">
              <table className="ha-table ha-table-zebra">
                <caption className="sr-only">
                  Administrative audit events. {sorted.length} of {allLogs.length} shown. Press Enter on a row
                  to open its full detail.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Action</th>
                    <th scope="col">Resource</th>
                    <th scope="col">Workspace</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.rows.map((log) => (
                    <tr
                      key={log.id}
                      tabIndex={0}
                      aria-label={`${auditActionLabel(log.action)} by ${auditActorLabel(log)} on ${auditResourceLabel(
                        log,
                      )}, ${log.result}. Press Enter to view details.`}
                      onClick={() => setSelectedId(log.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(log.id);
                        }
                      }}
                      className="ha-table-row-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)]"
                    >
                      <td className="whitespace-nowrap">
                        <time dateTime={log.createdAt} title={formatDateTime(log.createdAt)}>
                          {formatRelativeTime(new Date(log.createdAt).getTime(), now ?? Date.now())}
                        </time>
                      </td>

                      <td className="max-w-[15rem]">
                        <span className="flex items-center gap-2">
                          {isSystemActor(log) ? (
                            <span
                              aria-hidden="true"
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[color:var(--muted)] text-[color:var(--text-subtle)]"
                            >
                              <Icon name="bolt" size={12} />
                            </span>
                          ) : null}
                          <span className="min-w-0">
                            <span className="block truncate">{auditActorLabel(log)}</span>
                            {log.actorRole ? (
                              <span className="block truncate text-xs text-[color:var(--text-subtle)]">
                                {log.actorRole}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </td>

                      <td className="max-w-[16rem]">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="shrink-0 text-[color:var(--text-muted)]"
                          >
                            <Icon name={auditActionIcon(log.action)} size={14} />
                          </span>
                          <span className="truncate font-medium">{auditActionLabel(log.action)}</span>
                        </span>
                      </td>

                      <td className="max-w-[16rem]">
                        <span className="block truncate">{auditResourceLabel(log)}</span>
                        {log.targetType ? (
                          <span className="block truncate text-xs text-[color:var(--text-subtle)]">
                            {log.targetType}
                          </span>
                        ) : null}
                      </td>

                      <td className="max-w-[13rem]">
                        <span className="block truncate">
                          {log.workspaceName ?? (log.workspaceId ? log.workspaceId.slice(0, 8) : "—")}
                        </span>
                      </td>

                      <td>
                        <StatusBadge value={log.result} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={pageData.page}
              pageCount={pageData.pageCount}
              pageSize={pageSize}
              from={pageData.from}
              to={pageData.to}
              total={pageData.total}
              itemLabel="event"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </SectionCard>

      {hasLoadedOnce && allLogs.length >= LOADED_WINDOW ? (
        <p className="text-xs leading-relaxed text-[color:var(--text-subtle)]">
          Showing the most recent {LOADED_WINDOW} events. Older events are retained in the database but are not
          loaded here — the read endpoint returns a bounded newest-first window and has no cursor yet.
        </p>
      ) : null}

      <AuditLogDetailDrawer log={selectedLog} onClose={() => setSelectedId(null)} onCopy={handleCopy} />
    </div>
  );
}
