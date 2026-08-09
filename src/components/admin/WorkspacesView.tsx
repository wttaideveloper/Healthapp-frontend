"use client";

import { FormEvent, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { WorkspaceDetailDrawer } from "@/components/admin/WorkspaceDetailDrawer";
import { WorkspaceUpdateDialog } from "@/components/admin/WorkspaceUpdateDialog";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { AvatarGroup } from "@/components/ui/AvatarGroup";
import { DateField } from "@/components/ui/DateField";
import { FilterSelect, type FilterOption } from "@/components/ui/FilterSelect";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { SeatUsageBar } from "@/components/ui/SeatUsageBar";
import { EmptyState, SectionCard } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { copyToClipboard } from "@/lib/admin/clipboard";
import { formatDateTime, formatFriendlyDate } from "@/lib/format";
import { isPageSize, paginate, type PageSize } from "@/lib/admin/users";
import {
  clearFieldError,
  describedBy,
  focusFirstInvalidField,
  subscriptionStatusLabels,
  subscriptionStatusOptions,
  workspaceStatusLabels,
  workspaceStatusOptions,
} from "@/lib/admin/workspaceForm";
import {
  buildOwnerIndex,
  countActiveWorkspaceFilters,
  defaultWorkspaceFilters,
  filterWorkspaces,
  getSeatUsage,
  resolveOwner,
  sortWorkspaces,
  validateWorkspaceCreateDraft,
  type EntitlementFilter,
  type SeatFilter,
  type SortDirection,
  type SubscriptionFilter,
  type WorkspaceFormErrors,
  type WorkspaceFormField,
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
  /** Resolves the new workspace's id, or null when creation failed. */
  onCreateWorkspace: (event: FormEvent<HTMLFormElement>) => Promise<string | null>;
  // Update form — passed straight through to the dialog behind each row's menu.
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
  /** Resolves true when the save landed, so the update dialog knows to close. */
  onUpdateWorkspace: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  // Invite — reuses the existing member handler.
  memberEmail: string;
  setMemberEmail: (value: string) => void;
  memberRole: string;
  setMemberRole: (value: string) => void;
  onAddMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

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

/** Inputs of the create card, keyed by the field each one collects. */
const createFieldIds: Partial<Record<WorkspaceFormField, string>> = {
  name: "ws-name",
  ownerEmail: "ws-owner",
  seatLimit: "ws-seats",
  plan: "ws-plan",
  expiresAt: "ws-expires",
  notes: "ws-notes",
};

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
  const [updateDialogWorkspaceId, setUpdateDialogWorkspaceId] = useState<string | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [createErrors, setCreateErrors] = useState<WorkspaceFormErrors>({});
  /** The workspace just created — marked "New" and revealed in the directory. */
  const [newWorkspaceId, setNewWorkspaceId] = useState<string | null>(null);
  const directoryRef = useRef<HTMLElement>(null);
  const highlightTimerRef = useRef<number | null>(null);
  /** Guards the one-off scroll so later renders do not keep yanking the page. */
  const revealedWorkspaceIdRef = useRef<string | null>(null);

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

  /**
   * Walks a freshly created workspace into view.
   *
   * The directory it lands in may be searched, filtered, sorted and paginated,
   * so getting there is a short sequence rather than one step: clear filters
   * that would hide it, turn to the page it sits on, then scroll and focus the
   * row. Each step ends the pass and lets the next render re-enter with the
   * list already updated, which keeps the arithmetic honest — no guessing what
   * `sorted` will look like after a state change that has not happened yet.
   */
  useEffect(() => {
    if (!newWorkspaceId) return;
    // Still waiting on the refreshed list.
    if (!workspaces.some((workspace) => workspace.id === newWorkspaceId)) return;

    // Filters are component state, never a saved preference, so resetting them
    // here costs the admin nothing they had stored.
    if (!sorted.some((workspace) => workspace.id === newWorkspaceId)) {
      setFilters(defaultWorkspaceFilters);
      return;
    }

    const index = sorted.findIndex((workspace) => workspace.id === newWorkspaceId);
    const targetPage = Math.floor(index / pageSize) + 1;
    if (targetPage !== page) {
      setPage(targetPage);
      return;
    }

    if (revealedWorkspaceIdRef.current === newWorkspaceId) return;
    revealedWorkspaceIdRef.current = newWorkspaceId;

    // The table and the card list both render this row; only one of them is
    // displayed at a given width, and scrolling the hidden one does nothing.
    const candidates = Array.from(
      directoryRef.current?.querySelectorAll<HTMLElement>(`[data-workspace-row="${newWorkspaceId}"]`) ?? [],
    );
    const target = candidates.find((element) => element.offsetParent !== null) ?? candidates[0];
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    // Focus lands on the row itself: it is the keyboard entry point into the
    // record, and it gives the highlight a non-visual counterpart.
    target.focus({ preventScroll: true });
  }, [newWorkspaceId, workspaces, sorted, page, pageSize]);

  /** The "New" marking is a nudge, not a state — it retires on its own. */
  useEffect(() => {
    if (!newWorkspaceId) return;

    highlightTimerRef.current = window.setTimeout(() => setNewWorkspaceId(null), 6000);
    return () => {
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, [newWorkspaceId]);

  const drawerWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === drawerWorkspaceId) ?? null,
    [workspaces, drawerWorkspaceId],
  );

  const updateDialogWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === updateDialogWorkspaceId) ?? null,
    [workspaces, updateDialogWorkspaceId],
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

  /**
   * Opening the update dialog selects the workspace, which is what loads its
   * saved values into the form the dialog renders.
   */
  const openUpdateDialog = useCallback(
    async (workspaceId: string) => {
      setUpdateDialogWorkspaceId(workspaceId);
      if (workspaceId === selectedWorkspaceId) return;
      await onWorkspaceSelectionChange(workspaceId);
    },
    [onWorkspaceSelectionChange, selectedWorkspaceId],
  );

  /**
   * The create form checks itself before handing the event to the owning page,
   * which still builds and sends the exact same payload it always did. The
   * checks only exist so the admin reads "Please enter an organization name."
   * instead of a schema error from the server.
   */
  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const errors = validateWorkspaceCreateDraft({
      name: props.workspaceName,
      ownerEmail: props.workspaceOwnerEmail,
      seatLimit: props.workspaceSeatLimit,
      plan: props.workspacePlan,
      expiresAt: props.workspaceExpiresAt,
      notes: props.workspaceNotes,
    });

    setCreateErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstInvalidField(errors, createFieldIds);
      return;
    }

    // Only a confirmed save starts the reveal; a rejected one leaves the form
    // and the directory exactly as they were.
    const createdId = await props.onCreateWorkspace(event);
    if (!createdId) return;

    setCreateErrors({});
    revealedWorkspaceIdRef.current = null;
    setNewWorkspaceId(createdId);
  }

  const buildRowActions = useCallback(
    (workspace: Workspace): ActionMenuItem[] => [
      {
        key: "view",
        label: "View details",
        icon: "chevronRight",
        onSelect: () => void openWorkspace(workspace.id),
      },
      {
        key: "update",
        label: "Update workspace",
        icon: "settings",
        onSelect: () => void openUpdateDialog(workspace.id),
        hint: "Licenses, subscription, expiry, access",
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
    [handleCopy, isLoadingDashboard, onRefreshData, openUpdateDialog, openWorkspace],
  );

  const showSkeleton = isLoadingDashboard && workspaces.length === 0;
  const hasNoWorkspacesAtAll = !isLoadingDashboard && !dashboardError && workspaces.length === 0;
  const hasNoMatches = !isLoadingDashboard && workspaces.length > 0 && sorted.length === 0;

  return (
    <section className="space-y-5">
      {/* ====================================================== Create */}
      {/* Updating lives behind each row's action menu — see WorkspaceUpdateDialog. */}
      <SectionCard
        title="Create Workspace"
        description="Create a new organization and assign its administrator, licenses, and subscription."
        icon="plus"
      >
        {/* `noValidate` hands validation to our own friendly messages instead
            of the browser's generic "Please fill out this field" bubble. */}
        <form className="grid gap-3.5" noValidate onSubmit={(event) => void handleCreateSubmit(event)}>
          <div>
            <label className="ha-label" htmlFor="ws-name">
              Organization Name
            </label>
            <input
              id="ws-name"
              value={props.workspaceName}
              onChange={(e) => {
                props.setWorkspaceName(e.target.value);
                clearFieldError(setCreateErrors, "name");
              }}
              className="ha-input"
              placeholder="ABC Medical Center"
              maxLength={200}
              aria-invalid={createErrors.name ? true : undefined}
              aria-describedby={describedBy(createErrors.name && "ws-name-error")}
            />
            {createErrors.name ? (
              <p id="ws-name-error" role="alert" className="ha-error-text">
                {createErrors.name}
              </p>
            ) : null}
          </div>
          <div>
            <label className="ha-label" htmlFor="ws-owner">
              Organization Administrator Email
            </label>
            <input
              id="ws-owner"
              value={props.workspaceOwnerEmail}
              onChange={(e) => {
                props.setWorkspaceOwnerEmail(e.target.value);
                clearFieldError(setCreateErrors, "ownerEmail");
              }}
              className="ha-input"
              placeholder="admin@abcclinic.com"
              type="email"
              aria-invalid={createErrors.ownerEmail ? true : undefined}
              aria-describedby={describedBy(
                "ws-owner-hint",
                createErrors.ownerEmail && "ws-owner-error",
              )}
            />
            <p id="ws-owner-hint" className="ha-hint">
              This person manages the organization. If they do not have an account yet, their licence activates
              automatically when they sign up.
            </p>
            {createErrors.ownerEmail ? (
              <p id="ws-owner-error" role="alert" className="ha-error-text">
                {createErrors.ownerEmail}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="ha-label" htmlFor="ws-seats">
                Number of Licenses
              </label>
              <input
                id="ws-seats"
                value={props.workspaceSeatLimit}
                onChange={(e) => {
                  props.setWorkspaceSeatLimit(e.target.value);
                  clearFieldError(setCreateErrors, "seatLimit");
                }}
                className="ha-input"
                placeholder="10"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                aria-invalid={createErrors.seatLimit ? true : undefined}
                aria-describedby={describedBy(
                  "ws-seats-hint",
                  createErrors.seatLimit && "ws-seats-error",
                )}
              />
              <p id="ws-seats-hint" className="ha-hint">
                Maximum number of users allowed in this organization.
              </p>
              {createErrors.seatLimit ? (
                <p id="ws-seats-error" role="alert" className="ha-error-text">
                  {createErrors.seatLimit}
                </p>
              ) : null}
            </div>
            <div>
              <label className="ha-label" htmlFor="ws-plan">
                License Type
              </label>
              <input
                id="ws-plan"
                value={props.workspacePlan}
                onChange={(e) => {
                  props.setWorkspacePlan(e.target.value);
                  clearFieldError(setCreateErrors, "plan");
                }}
                className="ha-input"
                placeholder="organization"
                maxLength={100}
                aria-invalid={createErrors.plan ? true : undefined}
                aria-describedby={describedBy("ws-plan-hint", createErrors.plan && "ws-plan-error")}
              />
              <p id="ws-plan-hint" className="ha-hint">
                The plan this organization is billed on.
              </p>
              {createErrors.plan ? (
                <p id="ws-plan-error" role="alert" className="ha-error-text">
                  {createErrors.plan}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="ha-label" htmlFor="ws-sub-status">
                Subscription Status
              </label>
              <select
                id="ws-sub-status"
                value={props.workspaceSubscriptionStatus}
                onChange={(e) => props.setWorkspaceSubscriptionStatus(e.target.value)}
                className="ha-input"
              >
                {subscriptionStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {subscriptionStatusLabels[option] ?? option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="ha-label" htmlFor="ws-status">
                Organization Status
              </label>
              <select
                id="ws-status"
                value={props.workspaceStatus}
                onChange={(e) => props.setWorkspaceStatus(e.target.value)}
                className="ha-input"
              >
                {workspaceStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {workspaceStatusLabels[option] ?? option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="ha-label" htmlFor="ws-expires">
              Subscription Expiry Date{" "}
              <span className="font-normal text-[color:var(--text-subtle)]">(optional)</span>
            </label>
            <DateField
              id="ws-expires"
              label="Subscription expiry date"
              value={props.workspaceExpiresAt}
              onChange={(value) => {
                props.setWorkspaceExpiresAt(value);
                clearFieldError(setCreateErrors, "expiresAt");
              }}
              placeholder="Select a date"
              invalid={Boolean(createErrors.expiresAt)}
              describedBy={describedBy("ws-expires-hint", createErrors.expiresAt && "ws-expires-error")}
            />
            <p id="ws-expires-hint" className="ha-hint">
              The day access ends. Leave empty for a subscription that does not expire.
            </p>
            {createErrors.expiresAt ? (
              <p id="ws-expires-error" role="alert" className="ha-error-text">
                {createErrors.expiresAt}
              </p>
            ) : null}
          </div>
          <div>
            <label className="ha-label" htmlFor="ws-notes">
              Internal Notes <span className="font-normal text-[color:var(--text-subtle)]">(optional)</span>
            </label>
            <input
              id="ws-notes"
              value={props.workspaceNotes}
              onChange={(e) => {
                props.setWorkspaceNotes(e.target.value);
                clearFieldError(setCreateErrors, "notes");
              }}
              className="ha-input"
              placeholder="Annual subscription renewed."
              maxLength={1000}
              aria-invalid={createErrors.notes ? true : undefined}
              aria-describedby={describedBy("ws-notes-hint", createErrors.notes && "ws-notes-error")}
            />
            <p id="ws-notes-hint" className="ha-hint">
              Only visible to platform administrators.
            </p>
            {createErrors.notes ? (
              <p id="ws-notes-error" role="alert" className="ha-error-text">
                {createErrors.notes}
              </p>
            ) : null}
          </div>
          <button type="submit" disabled={isBusy} className="ha-btn ha-btn-primary mt-1 w-full">
            <Icon name="plus" size={14} />
            {isBusy ? "Working…" : "Create Workspace"}
          </button>
        </form>
      </SectionCard>

      {/* ================================================== Directory */}
      {/* Wrapper exists so the reveal can scope its row lookup to the directory. */}
      <section ref={directoryRef}>
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
                    const isNew = workspace.id === newWorkspaceId;
                    const rowMembers = isSelected ? members : [];

                    return (
                      <tr
                        key={workspace.id}
                        data-workspace-row={workspace.id}
                        tabIndex={0}
                        aria-label={`${workspace.name}${isNew ? ", just created" : ""}, owned by ${owner.name ?? owner.email}. Press Enter to view details.`}
                        onClick={() => void openWorkspace(workspace.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void openWorkspace(workspace.id);
                          }
                        }}
                        className={`cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)] ${
                          isNew ? "ha-row-new" : isSelected ? "ha-table-row-selected" : "ha-table-row-hover"
                        }`}
                      >
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                              <Icon name="building" size={15} />
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate font-medium">{workspace.name}</span>
                                {isNew ? <span className="ha-badge ha-badge-success shrink-0">New</span> : null}
                              </span>
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
                            formatFriendlyDate(workspace.expiresAt)
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
                const isNew = workspace.id === newWorkspaceId;

                return (
                  <li
                    key={workspace.id}
                    data-workspace-row={workspace.id}
                    // Programmatically focusable only — the card's own controls
                    // stay the keyboard route into the record.
                    tabIndex={-1}
                    aria-label={isNew ? `${workspace.name}, just created` : undefined}
                    className={`px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)] ${
                      isNew ? "ha-row-new" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                        <Icon name="building" size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void openWorkspace(workspace.id)}
                            aria-label={`View details for ${workspace.name}`}
                            className="ha-tap-target block min-w-0 truncate text-left text-[0.875rem] font-semibold transition-colors hover:text-[color:var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                          >
                            {workspace.name}
                          </button>
                          {isNew ? <span className="ha-badge ha-badge-success shrink-0">New</span> : null}
                        </span>
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
      </section>

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

      {/* ============================================= Update dialog */}
      <WorkspaceUpdateDialog
        open={updateDialogWorkspaceId !== null}
        workspace={updateDialogWorkspace}
        isBusy={isBusy}
        onClose={() => setUpdateDialogWorkspaceId(null)}
        updateSeatLimit={props.updateSeatLimit}
        setUpdateSeatLimit={props.setUpdateSeatLimit}
        updatePlan={props.updatePlan}
        setUpdatePlan={props.setUpdatePlan}
        updateSubscriptionStatus={props.updateSubscriptionStatus}
        setUpdateSubscriptionStatus={props.setUpdateSubscriptionStatus}
        updateStatus={props.updateStatus}
        setUpdateStatus={props.setUpdateStatus}
        updateNotes={props.updateNotes}
        setUpdateNotes={props.setUpdateNotes}
        updateExpiresAt={props.updateExpiresAt}
        setUpdateExpiresAt={props.setUpdateExpiresAt}
        onUpdateWorkspace={props.onUpdateWorkspace}
      />
    </section>
  );
}
