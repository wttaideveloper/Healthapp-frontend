"use client";

import { FormEvent, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import { WorkspaceDetailDrawer } from "@/components/admin/WorkspaceDetailDrawer";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { AvatarGroup } from "@/components/ui/AvatarGroup";
import { FilterSelect, type FilterOption } from "@/components/ui/FilterSelect";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { SeatUsageBar } from "@/components/ui/SeatUsageBar";
import { EmptyState, SectionCard } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { copyToClipboard } from "@/lib/admin/clipboard";
import { formatDateTime } from "@/lib/format";
import { isPageSize, paginate, type PageSize } from "@/lib/admin/users";
import {
  buildOwnerIndex,
  countActiveWorkspaceFilters,
  defaultWorkspaceFilters,
  filterWorkspaces,
  getSeatUsage,
  resolveOwner,
  sortWorkspaces,
  type EntitlementFilter,
  type SeatFilter,
  type SortDirection,
  type SubscriptionFilter,
  type WorkspaceSortKey,
  type WorkspaceStatusFilter,
} from "@/lib/admin/workspaces";
import type { AdminUser, Workspace, WorkspaceMember } from "@/types/admin";

type WorkspacesViewProps = {
  workspaces: Workspace[];
  users: AdminUser[];
  members: WorkspaceMember[];
  selectedWorkspaceId: string;
  onWorkspaceSelectionChange: (workspaceId: string) => Promise<void>;
  isLoadingDashboard: boolean;
  dashboardError: string | null;
  isBusy: boolean;
  onRefreshData: () => void;
  onNotify: (type: "success" | "error", message: string) => void;
  // Create form — preserved verbatim.
  workspaceName: string;
  setWorkspaceName: (value: string) => void;
  workspaceOwnerEmail: string;
  setWorkspaceOwnerEmail: (value: string) => void;
  workspaceSeatLimit: string;
  setWorkspaceSeatLimit: (value: string) => void;
  workspacePlan: string;
  setWorkspacePlan: (value: string) => void;
  workspaceSubscriptionStatus: string;
  setWorkspaceSubscriptionStatus: (value: string) => void;
  workspaceStatus: string;
  setWorkspaceStatus: (value: string) => void;
  workspaceNotes: string;
  setWorkspaceNotes: (value: string) => void;
  workspaceExpiresAt: string;
  setWorkspaceExpiresAt: (value: string) => void;
  onCreateWorkspace: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  // Update form — preserved verbatim.
  updateSeatLimit: string;
  setUpdateSeatLimit: (value: string) => void;
  updatePlan: string;
  setUpdatePlan: (value: string) => void;
  updateSubscriptionStatus: string;
  setUpdateSubscriptionStatus: (value: string) => void;
  updateStatus: string;
  setUpdateStatus: (value: string) => void;
  updateNotes: string;
  setUpdateNotes: (value: string) => void;
  updateExpiresAt: string;
  setUpdateExpiresAt: (value: string) => void;
  onUpdateWorkspace: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  // Invite — reuses the existing member handler.
  memberEmail: string;
  setMemberEmail: (value: string) => void;
  memberRole: string;
  setMemberRole: (value: string) => void;
  onAddMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

const subscriptionStatusOptions = ["active", "trialing", "past_due", "expired", "canceled"];
const workspaceStatusOptions = ["active", "suspended", "revoked"];

const statusFilterOptions: ReadonlyArray<FilterOption<WorkspaceStatusFilter>> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "revoked", label: "Revoked" },
];

const subscriptionFilterOptions: ReadonlyArray<FilterOption<SubscriptionFilter>> = [
  { value: "all", label: "All subscriptions" },
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "past_due", label: "Past due" },
  { value: "expired", label: "Expired" },
  { value: "canceled", label: "Canceled" },
];

const seatFilterOptions: ReadonlyArray<FilterOption<SeatFilter>> = [
  { value: "all", label: "All seat usage" },
  { value: "available", label: "Seats available" },
  { value: "full", label: "At capacity" },
  { value: "over", label: "Over capacity" },
];

const entitlementFilterOptions: ReadonlyArray<FilterOption<EntitlementFilter>> = [
  { value: "all", label: "All access" },
  { value: "entitled", label: "Pro unlocked" },
  { value: "not-entitled", label: "Pro locked" },
];

const sortableColumns: Array<{ key: WorkspaceSortKey; label: string }> = [
  { key: "name", label: "Workspace" },
  { key: "owner", label: "Owner" },
];

function SortButton({
  label,
  columnKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  columnKey: WorkspaceSortKey;
  activeKey: WorkspaceSortKey;
  direction: SortDirection;
  onSort: (key: WorkspaceSortKey) => void;
}) {
  const isActive = activeKey === columnKey;
  const nextDirection = isActive && direction === "asc" ? "descending" : "ascending";

  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      aria-label={`Sort by ${label}, ${nextDirection}`}
      className={`ha-sort-button ${isActive ? "ha-sort-active" : ""}`}
    >
      {label}
      <span className="ha-sort-indicator">
        <Icon name={isActive ? (direction === "asc" ? "sortAsc" : "sortDesc") : "sortNone"} size={12} />
      </span>
    </button>
  );
}

export function WorkspacesView(props: WorkspacesViewProps) {
  const {
    workspaces,
    users,
    members,
    selectedWorkspaceId,
    isLoadingDashboard,
    dashboardError,
    isBusy,
    onNotify,
    onRefreshData,
    onWorkspaceSelectionChange,
  } = props;

  const [filters, setFilters] = useState(defaultWorkspaceFilters);
  const [sortKey, setSortKey] = useState<WorkspaceSortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useLocalStorageState<PageSize>(
    "healthage.admin.workspaces.pageSize",
    25,
    isPageSize,
  );
  const [drawerWorkspaceId, setDrawerWorkspaceId] = useState<string | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(() => ({ ...filters, search: deferredSearch }), [filters, deferredSearch]);

  const ownerIndex = useMemo(() => buildOwnerIndex(users), [users]);

  const filtered = useMemo(
    () => filterWorkspaces(workspaces, effectiveFilters, ownerIndex),
    [workspaces, effectiveFilters, ownerIndex],
  );
  const sorted = useMemo(
    () => sortWorkspaces(filtered, sortKey, sortDirection, ownerIndex),
    [filtered, sortKey, sortDirection, ownerIndex],
  );
  const pageData = useMemo(() => paginate(sorted, page, pageSize), [sorted, page, pageSize]);

  const activeFilterCount = useMemo(() => countActiveWorkspaceFilters(effectiveFilters), [effectiveFilters]);

  useEffect(() => {
    if (page !== pageData.page) setPage(pageData.page);
  }, [page, pageData.page]);

  useEffect(() => {
    setPage(1);
  }, [effectiveFilters, sortKey, sortDirection, pageSize]);

  const drawerWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === drawerWorkspaceId) ?? null,
    [workspaces, drawerWorkspaceId],
  );

  // Members are fetched per selected workspace; only show them when the loaded
  // set actually belongs to the workspace the drawer is displaying.
  const drawerMembers = selectedWorkspaceId === drawerWorkspaceId ? members : [];

  const handleSort = useCallback(
    (key: WorkspaceSortKey) => {
      if (key === sortKey) {
        setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
        return;
      }
      setSortKey(key);
      setSortDirection(key === "createdAt" || key === "seats" ? "desc" : "asc");
    },
    [sortKey],
  );

  const handleCopy = useCallback(
    async (value: string, label: string) => {
      const copied = await copyToClipboard(value);
      onNotify(copied ? "success" : "error", copied ? `${label} copied to clipboard.` : `Could not copy ${label}.`);
    },
    [onNotify],
  );

  /** Opening the drawer also selects the workspace, which loads its members. */
  const openWorkspace = useCallback(
    async (workspaceId: string) => {
      setDrawerWorkspaceId(workspaceId);
      if (workspaceId === selectedWorkspaceId) return;
      setIsLoadingMembers(true);
      try {
        await onWorkspaceSelectionChange(workspaceId);
      } finally {
        setIsLoadingMembers(false);
      }
    },
    [onWorkspaceSelectionChange, selectedWorkspaceId],
  );

  const buildRowActions = useCallback(
    (workspace: Workspace): ActionMenuItem[] => [
      {
        key: "view",
        label: "View details",
        icon: "chevronRight",
        onSelect: () => void openWorkspace(workspace.id),
      },
      {
        key: "copy-id",
        label: "Copy workspace ID",
        icon: "copy",
        onSelect: () => void handleCopy(workspace.id, "Workspace ID"),
      },
      {
        key: "copy-owner",
        label: "Copy owner email",
        icon: "mail",
        onSelect: () => void handleCopy(workspace.ownerEmail, "Owner email"),
      },
      {
        key: "copy-name",
        label: "Copy workspace name",
        icon: "copy",
        onSelect: () => void handleCopy(workspace.name, "Workspace name"),
      },
      {
        key: "invite",
        label: "Invite member",
        icon: "userPlus",
        onSelect: () => void openWorkspace(workspace.id),
        hint: "Opens the workspace panel",
      },
      {
        key: "refresh",
        label: "Refresh workspace",
        icon: "refresh",
        disabled: isLoadingDashboard,
        onSelect: onRefreshData,
      },
    ],
    [handleCopy, isLoadingDashboard, onRefreshData, openWorkspace],
  );

  const showSkeleton = isLoadingDashboard && workspaces.length === 0;
  const hasNoWorkspacesAtAll = !isLoadingDashboard && !dashboardError && workspaces.length === 0;
  const hasNoMatches = !isLoadingDashboard && workspaces.length > 0 && sorted.length === 0;

  return (
    <section className="space-y-5">
      {/* ============================================ Create / Update */}
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Create Workspace"
          description="Provision a paid organization after payment is confirmed"
          icon="plus"
        >
          <form className="grid gap-3.5" onSubmit={props.onCreateWorkspace}>
            <div>
              <label className="ha-label" htmlFor="ws-name">
                Workspace name
              </label>
              <input
                id="ws-name"
                value={props.workspaceName}
                onChange={(e) => props.setWorkspaceName(e.target.value)}
                className="ha-input"
                placeholder="Clinic ABC"
                required
              />
            </div>
            <div>
              <label className="ha-label" htmlFor="ws-owner">
                Owner email
              </label>
              <input
                id="ws-owner"
                value={props.workspaceOwnerEmail}
                onChange={(e) => props.setWorkspaceOwnerEmail(e.target.value)}
                className="ha-input"
                placeholder="owner@clinic.com"
                type="email"
                required
              />
              <p className="mt-1.5 text-xs text-[color:var(--text-subtle)]">
                If no account exists yet, the seat activates automatically on sign-up.
              </p>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label className="ha-label" htmlFor="ws-seats">
                  Seat limit
                </label>
                <input
                  id="ws-seats"
                  value={props.workspaceSeatLimit}
                  onChange={(e) => props.setWorkspaceSeatLimit(e.target.value)}
                  className="ha-input"
                  placeholder="25"
                  type="number"
                  min={1}
                />
              </div>
              <div>
                <label className="ha-label" htmlFor="ws-plan">
                  Plan
                </label>
                <input
                  id="ws-plan"
                  value={props.workspacePlan}
                  onChange={(e) => props.setWorkspacePlan(e.target.value)}
                  className="ha-input"
                  placeholder="organization"
                />
              </div>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label className="ha-label" htmlFor="ws-sub-status">
                  Subscription status
                </label>
                <select
                  id="ws-sub-status"
                  value={props.workspaceSubscriptionStatus}
                  onChange={(e) => props.setWorkspaceSubscriptionStatus(e.target.value)}
                  className="ha-input"
                >
                  {subscriptionStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ha-label" htmlFor="ws-status">
                  Workspace status
                </label>
                <select
                  id="ws-status"
                  value={props.workspaceStatus}
                  onChange={(e) => props.setWorkspaceStatus(e.target.value)}
                  className="ha-input"
                >
                  {workspaceStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="ha-label" htmlFor="ws-expires">
                Expires at <span className="font-normal text-[color:var(--text-subtle)]">(optional)</span>
              </label>
              <input
                id="ws-expires"
                value={props.workspaceExpiresAt}
                onChange={(e) => props.setWorkspaceExpiresAt(e.target.value)}
                className="ha-input"
                placeholder="2026-12-31T00:00:00.000Z"
              />
            </div>
            <div>
              <label className="ha-label" htmlFor="ws-notes">
                Notes <span className="font-normal text-[color:var(--text-subtle)]">(optional)</span>
              </label>
              <input
                id="ws-notes"
                value={props.workspaceNotes}
                onChange={(e) => props.setWorkspaceNotes(e.target.value)}
                className="ha-input"
                placeholder="Paid by invoice"
              />
            </div>
            <button type="submit" disabled={isBusy} className="ha-btn ha-btn-primary mt-1 w-full">
              <Icon name="plus" size={14} />
              {isBusy ? "Working…" : "Create Workspace"}
            </button>
          </form>
        </SectionCard>

        <SectionCard
          title="Update Workspace"
          description="Change seats, plan, or revoke organization access"
          icon="refresh"
        >
          <form className="grid gap-3.5" onSubmit={props.onUpdateWorkspace}>
            <div>
              <label className="ha-label" htmlFor="ws-select">
                Workspace
              </label>
              <select
                id="ws-select"
                value={selectedWorkspaceId}
                onChange={(e) => void onWorkspaceSelectionChange(e.target.value)}
                className="ha-input"
              >
                <option value="">Select workspace</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label className="ha-label" htmlFor="ws-update-seats">
                  Seat limit
                </label>
                <input
                  id="ws-update-seats"
                  value={props.updateSeatLimit}
                  onChange={(e) => props.setUpdateSeatLimit(e.target.value)}
                  className="ha-input"
                  placeholder="25"
                  type="number"
                  min={1}
                />
              </div>
              <div>
                <label className="ha-label" htmlFor="ws-update-plan">
                  Plan
                </label>
                <input
                  id="ws-update-plan"
                  value={props.updatePlan}
                  onChange={(e) => props.setUpdatePlan(e.target.value)}
                  className="ha-input"
                  placeholder="organization"
                />
              </div>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label className="ha-label" htmlFor="ws-update-sub">
                  Subscription status
                </label>
                <select
                  id="ws-update-sub"
                  value={props.updateSubscriptionStatus}
                  onChange={(e) => props.setUpdateSubscriptionStatus(e.target.value)}
                  className="ha-input"
                >
                  {subscriptionStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="ha-label" htmlFor="ws-update-status">
                  Workspace status
                </label>
                <select
                  id="ws-update-status"
                  value={props.updateStatus}
                  onChange={(e) => props.setUpdateStatus(e.target.value)}
                  className="ha-input"
                >
                  {workspaceStatusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="ha-label" htmlFor="ws-update-expires">
                Expires at
              </label>
              <input
                id="ws-update-expires"
                value={props.updateExpiresAt}
                onChange={(e) => props.setUpdateExpiresAt(e.target.value)}
                className="ha-input"
                placeholder="2026-12-31T00:00:00.000Z"
              />
            </div>
            <div>
              <label className="ha-label" htmlFor="ws-update-notes">
                Notes
              </label>
              <input
                id="ws-update-notes"
                value={props.updateNotes}
                onChange={(e) => props.setUpdateNotes(e.target.value)}
                className="ha-input"
                placeholder="Renewed for 2026"
              />
            </div>
            <button
              type="submit"
              disabled={!selectedWorkspaceId || isBusy}
              className="ha-btn ha-btn-primary mt-1 w-full"
            >
              <Icon name="check" size={14} />
              {isBusy ? "Working…" : "Update Workspace"}
            </button>
          </form>
        </SectionCard>
      </div>

      {/* ================================================== Directory */}
      <SectionCard
        title="Workspace Directory"
        description="Search, filter, and inspect every organization workspace"
        icon="building"
        flush
        action={
          <span className="ha-badge ha-badge-neutral">
            {sorted.length === workspaces.length
              ? `${workspaces.length} ${workspaces.length === 1 ? "workspace" : "workspaces"}`
              : `${sorted.length} of ${workspaces.length}`}
          </span>
        }
      >
        {/* Toolbar */}
        <div className="border-b border-[color:var(--border)] px-5 py-3.5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <SearchInput
              value={filters.search}
              onChange={(search) => setFilters((current) => ({ ...current, search }))}
              placeholder="Search by workspace, owner, or email…"
              label="Search workspaces by name, owner name, or owner email"
              resultsLabel={`${sorted.length} workspaces match the current filters`}
              className="xl:max-w-xs xl:flex-1"
            />

            <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
              <FilterSelect
                id="filter-ws-status"
                label="Filter by workspace status"
                value={filters.status}
                options={statusFilterOptions}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
              <FilterSelect
                id="filter-ws-subscription"
                label="Filter by subscription status"
                value={filters.subscription}
                options={subscriptionFilterOptions}
                onChange={(subscription) => setFilters((current) => ({ ...current, subscription }))}
              />
              <FilterSelect
                id="filter-ws-seats"
                label="Filter by seat usage"
                value={filters.seats}
                options={seatFilterOptions}
                onChange={(seats) => setFilters((current) => ({ ...current, seats }))}
              />
              <FilterSelect
                id="filter-ws-entitlement"
                label="Filter by Pro access"
                value={filters.entitlement}
                options={entitlementFilterOptions}
                onChange={(entitlement) => setFilters((current) => ({ ...current, entitlement }))}
              />

              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilters(defaultWorkspaceFilters)}
                  className="ha-btn ha-btn-ghost ha-btn-sm"
                >
                  <Icon name="x" size={12} />
                  Clear
                  <span className="ha-badge ha-badge-info ml-0.5">{activeFilterCount}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Error */}
        {dashboardError ? (
          <div role="alert" className="flex items-start gap-3 bg-[color:var(--danger-soft)] px-5 py-4">
            <span className="mt-0.5 text-[color:var(--danger)]">
              <Icon name="alert" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-semibold text-[color:var(--danger)]">Could not load workspaces</p>
              <p className="mt-1 text-xs leading-relaxed text-[color:var(--danger)] opacity-90">{dashboardError}</p>
            </div>
            <button type="button" onClick={onRefreshData} className="ha-btn ha-btn-secondary ha-btn-sm">
              <Icon name="refresh" size={13} />
              Retry
            </button>
          </div>
        ) : null}

        {/* Loading */}
        {showSkeleton ? (
          <ul className="divide-y divide-[color:var(--border)]">
            {[0, 1, 2, 3, 4].map((row) => (
              <li key={row} className="flex items-center gap-3 px-5 py-3.5">
                <div className="ha-skeleton h-8 w-8 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <div className="ha-skeleton h-3.5 w-44" />
                  <div className="ha-skeleton mt-2 h-3 w-60" />
                </div>
                <div className="ha-skeleton hidden h-5 w-16 rounded-full md:block" />
                <div className="ha-skeleton hidden h-1.5 w-24 rounded-full md:block" />
              </li>
            ))}
          </ul>
        ) : null}

        {/* Empty states */}
        {hasNoWorkspacesAtAll ? (
          <EmptyState
            icon="building"
            title="No workspaces yet"
            description="Create a workspace above to provision organization access. Owners are invited by email and activate automatically on sign-up."
          />
        ) : null}

        {hasNoMatches ? (
          <EmptyState
            icon="search"
            title="No matching workspaces"
            description="Try a different search term, or reset the filters to see every organization."
            action={
              <button
                type="button"
                onClick={() => setFilters(defaultWorkspaceFilters)}
                className="ha-btn ha-btn-secondary"
              >
                <Icon name="x" size={13} />
                Clear filters
              </button>
            }
          />
        ) : null}

        {/* Data */}
        {!showSkeleton && pageData.rows.length > 0 ? (
          <>
            {/* Desktop table */}
            <div className="ha-scroll hidden max-h-[calc(100vh-24rem)] overflow-auto md:block">
              <table className="ha-table ha-table-zebra">
                <caption className="sr-only">
                  Organization workspaces. {sorted.length} of {workspaces.length} shown, sorted by {sortKey}{" "}
                  {sortDirection}ending.
                </caption>
                <thead>
                  <tr>
                    {sortableColumns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={
                          sortKey === column.key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                        }
                      >
                        <SortButton
                          label={column.label}
                          columnKey={column.key}
                          activeKey={sortKey}
                          direction={sortDirection}
                          onSort={handleSort}
                        />
                      </th>
                    ))}
                    <th scope="col">Status</th>
                    <th scope="col">Subscription</th>
                    <th
                      scope="col"
                      className="min-w-[9rem]"
                      aria-sort={sortKey === "seats" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
                    >
                      <SortButton
                        label="Seats"
                        columnKey="seats"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        sortKey === "expiresAt" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                      }
                    >
                      <SortButton
                        label="Expires"
                        columnKey="expiresAt"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        sortKey === "createdAt" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                      }
                    >
                      <SortButton
                        label="Created"
                        columnKey="createdAt"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.rows.map((workspace) => {
                    const owner = resolveOwner(workspace, ownerIndex);
                    const usage = getSeatUsage(workspace);
                    const isSelected = workspace.id === selectedWorkspaceId;
                    const rowMembers = isSelected ? members : [];

                    return (
                      <tr
                        key={workspace.id}
                        tabIndex={0}
                        aria-label={`${workspace.name}, owned by ${owner.name ?? owner.email}. Press Enter to view details.`}
                        onClick={() => void openWorkspace(workspace.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void openWorkspace(workspace.id);
                          }
                        }}
                        className={`cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)] ${
                          isSelected ? "ha-table-row-selected" : "ha-table-row-hover"
                        }`}
                      >
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                              <Icon name="building" size={15} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{workspace.name}</span>
                              <span className="flex items-center gap-1.5">
                                {rowMembers.length > 0 ? (
                                  <AvatarGroup
                                    label={`${rowMembers.length} members in ${workspace.name}`}
                                    entries={rowMembers.map((member) => ({
                                      id: member.id,
                                      label: member.email.split("@")[0] ?? member.email,
                                      emphasis: member.role === "owner",
                                      muted: member.status !== "active",
                                    }))}
                                  />
                                ) : null}
                                <span className="truncate text-xs text-[color:var(--text-subtle)]">
                                  {workspace.plan}
                                </span>
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="text-[color:var(--text-muted)]">
                          <span className="block truncate font-medium text-[color:var(--foreground)]">
                            {owner.name ?? "—"}
                          </span>
                          <span className="block truncate text-xs">{owner.email}</span>
                        </td>
                        <td>
                          <StatusBadge value={workspace.status} />
                        </td>
                        <td>
                          <StatusBadge value={workspace.subscriptionStatus} />
                        </td>
                        <td>
                          <SeatUsageBar usage={usage} label={workspace.name} />
                        </td>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">
                          {workspace.expiresAt ? (
                            formatDateTime(workspace.expiresAt)
                          ) : (
                            <span className="text-[color:var(--text-subtle)]">No expiry</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-[color:var(--text-muted)]">
                          {formatDateTime(workspace.createdAt)}
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end">
                            <ActionMenu
                              items={buildRowActions(workspace)}
                              label={`Actions for ${workspace.name}`}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-[color:var(--border)] md:hidden">
              {pageData.rows.map((workspace) => {
                const owner = resolveOwner(workspace, ownerIndex);
                const usage = getSeatUsage(workspace);

                return (
                  <li key={workspace.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                        <Icon name="building" size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => void openWorkspace(workspace.id)}
                          aria-label={`View details for ${workspace.name}`}
                          className="block max-w-full truncate text-left text-[0.875rem] font-semibold transition-colors hover:text-[color:var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                        >
                          {workspace.name}
                        </button>
                        <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">
                          {owner.name ? `${owner.name} · ` : ""}
                          {owner.email}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <StatusBadge value={workspace.status} />
                          <StatusBadge value={workspace.subscriptionStatus} />
                          <span className="ha-badge ha-badge-neutral">{workspace.plan}</span>
                        </div>
                      </div>
                      <ActionMenu items={buildRowActions(workspace)} label={`Actions for ${workspace.name}`} />
                    </div>

                    <SeatUsageBar usage={usage} showCaption label={workspace.name} className="mt-3" />

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void openWorkspace(workspace.id)}
                        className="ha-btn ha-btn-secondary ha-btn-sm flex-1"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopy(workspace.ownerEmail, "Owner email")}
                        aria-label={`Copy owner email for ${workspace.name}`}
                        className="ha-btn ha-btn-secondary ha-btn-sm flex-1"
                      >
                        <Icon name="mail" size={13} />
                        Copy owner
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Pagination
              page={pageData.page}
              pageCount={pageData.pageCount}
              pageSize={pageSize}
              from={pageData.from}
              to={pageData.to}
              total={pageData.total}
              itemLabel="workspace"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : null}
      </SectionCard>

      {/* ==================================================== Drawer */}
      <WorkspaceDetailDrawer
        workspace={drawerWorkspace}
        ownerIndex={ownerIndex}
        members={drawerMembers}
        isLoadingMembers={isLoadingMembers}
        isBusy={isBusy}
        onClose={() => setDrawerWorkspaceId(null)}
        onCopy={(value, label) => void handleCopy(value, label)}
        canInvite={drawerWorkspace !== null && drawerWorkspace.id === selectedWorkspaceId}
        memberEmail={props.memberEmail}
        setMemberEmail={props.setMemberEmail}
        memberRole={props.memberRole}
        setMemberRole={props.setMemberRole}
        onAddMember={props.onAddMember}
      />
    </section>
  );
}
