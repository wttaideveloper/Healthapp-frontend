"use client";

import {
  FormEvent,
  ReactNode,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";

import { MemberDetailDrawer } from "@/components/admin/MemberDetailDrawer";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FilterSelect, type FilterOption } from "@/components/ui/FilterSelect";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { OrganizationSelect, type OrganizationOption } from "@/components/ui/OrganizationSelect";
import { EmptyState, SectionCard } from "@/components/ui/Section";
import { SeatUsageBar } from "@/components/ui/SeatUsageBar";
import { RoleBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { copyToClipboard } from "@/lib/admin/clipboard";
import { isPageSize, paginate, type PageSize } from "@/lib/admin/users";
import { getSeatUsage } from "@/lib/admin/workspaces";
import {
  buildMemberIdentityIndex,
  countActiveMemberFilters,
  defaultMemberFilters,
  filterMembers,
  getInvitationAgeDays,
  getMemberCapabilities,
  getPendingInvitations,
  occupiesSeat,
  resolveMemberIdentity,
  sortMembers,
  summarizeMemberList,
  unsupportedMemberActions,
  type MemberRoleFilter,
  type MemberSeatFilter,
  type MemberSortKey,
  type MemberStatusFilter,
  type SortDirection,
} from "@/lib/admin/members";
import { formatDateTime } from "@/lib/format";
import type { AdminUser, Workspace, WorkspaceMember, WorkspaceMembership } from "@/types/admin";

type MembersViewProps = {
  members: WorkspaceMember[];
  users: AdminUser[];
  workspaces: Workspace[];
  myWorkspaces: WorkspaceMembership[];
  selectedWorkspaceId: string;
  selectedWorkspace: Workspace | null;
  onWorkspaceSelectionChange: (workspaceId: string) => Promise<void>;
  isPlatformAdmin: boolean;
  isLoadingDashboard: boolean;
  dashboardError: string | null;
  isBusy: boolean;
  onRefreshData: () => void;
  onNotify: (type: "success" | "error", message: string) => void;
  // Existing handlers — reused verbatim.
  memberEmail: string;
  setMemberEmail: (value: string) => void;
  memberRole: string;
  setMemberRole: (value: string) => void;
  onAddMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUpdateMember: (memberId: string, role: string, status: string) => Promise<void>;
  onRevokeMember: (memberId: string) => Promise<void>;
};

const statusFilterOptions: ReadonlyArray<FilterOption<MemberStatusFilter>> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "revoked", label: "Revoked" },
];

const roleFilterOptions: ReadonlyArray<FilterOption<MemberRoleFilter>> = [
  { value: "all", label: "All roles" },
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
];

const seatFilterOptions: ReadonlyArray<FilterOption<MemberSeatFilter>> = [
  { value: "all", label: "All seats" },
  { value: "has-seat", label: "Has seat" },
  { value: "no-seat", label: "No seat" },
];

const sortableColumns: Array<{ key: MemberSortKey; label: string }> = [
  { key: "name", label: "Member" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
];

function SortButton({
  label,
  columnKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  columnKey: MemberSortKey;
  activeKey: MemberSortKey;
  direction: SortDirection;
  onSort: (key: MemberSortKey) => void;
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

/** One row of the organization picker, flattened from either workspace shape. */
type OrganizationRow = {
  id: string;
  name: string;
  seatLimit: number | null;
  activeSeatCount: number;
  badges: ReactNode;
};

/** "1 of 10 licenses used" — the phrasing the whole page uses for seats. */
function describeLicenseUsage(used: number, limit: number | null): string {
  if (limit === null || limit <= 0) {
    return `${used} ${used === 1 ? "license" : "licenses"} used · no limit set`;
  }
  return `${used} of ${limit} ${limit === 1 ? "license" : "licenses"} used`;
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`ha-badge ${tone} tabular-nums`}>{value}</span>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  );
}

export function MembersView(props: MembersViewProps) {
  const {
    members,
    users,
    selectedWorkspaceId,
    selectedWorkspace,
    isPlatformAdmin,
    isLoadingDashboard,
    dashboardError,
    isBusy,
    onNotify,
    onRefreshData,
  } = props;

  const [filters, setFilters] = useState(defaultMemberFilters);
  const [sortKey, setSortKey] = useState<MemberSortKey>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useLocalStorageState<PageSize>("healthage.admin.members.pageSize", 25, isPageSize);
  const [drawerMemberId, setDrawerMemberId] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<WorkspaceMember | null>(null);
  const [isSwitchingOrganization, setIsSwitchingOrganization] = useState(false);

  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(() => ({ ...filters, search: deferredSearch }), [filters, deferredSearch]);

  const identityIndex = useMemo(() => buildMemberIdentityIndex(users), [users]);

  /**
   * Members are fetched one organization at a time, and the previous list stays
   * in state until the new request resolves. Every row carries the organization
   * it belongs to, so scoping by that id is what keeps rows from the organization
   * you just left off the screen — no extra state, and it covers the initial
   * dashboard load too.
   */
  const scopedMembers = useMemo(
    () => (selectedWorkspaceId ? members.filter((member) => member.workspaceId === selectedWorkspaceId) : []),
    [members, selectedWorkspaceId],
  );

  const filtered = useMemo(
    () => filterMembers(scopedMembers, effectiveFilters, identityIndex),
    [scopedMembers, effectiveFilters, identityIndex],
  );
  const sorted = useMemo(
    () => sortMembers(filtered, sortKey, sortDirection, identityIndex),
    [filtered, sortKey, sortDirection, identityIndex],
  );
  const pageData = useMemo(() => paginate(sorted, page, pageSize), [sorted, page, pageSize]);

  const summary = useMemo(() => summarizeMemberList(scopedMembers), [scopedMembers]);
  const pendingInvitations = useMemo(() => getPendingInvitations(scopedMembers), [scopedMembers]);
  const activeFilterCount = useMemo(() => countActiveMemberFilters(effectiveFilters), [effectiveFilters]);

  useEffect(() => {
    if (page !== pageData.page) setPage(pageData.page);
  }, [page, pageData.page]);

  useEffect(() => {
    setPage(1);
  }, [effectiveFilters, sortKey, sortDirection, pageSize]);

  // Changing workspace replaces the member list entirely.
  useEffect(() => {
    setDrawerMemberId(null);
    setPage(1);
  }, [selectedWorkspaceId]);

  const drawerMember = useMemo(
    () => scopedMembers.find((member) => member.id === drawerMemberId) ?? null,
    [scopedMembers, drawerMemberId],
  );

  /**
   * Organizations to choose between. A platform admin picks from every
   * workspace; a workspace manager picks from the ones they belong to. Both
   * shapes carry the seat fields, so the licence line reads the same either way
   * — and the manager path is the only place their seat limit is available at
   * all, since `selectedWorkspace` is fed from the admin-only list.
   */
  const organizations = useMemo<OrganizationRow[]>(
    () =>
      isPlatformAdmin
        ? props.workspaces.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            seatLimit: workspace.seatLimit,
            activeSeatCount: workspace.activeSeatCount,
            badges: <StatusBadge value={workspace.status} />,
          }))
        : props.myWorkspaces.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            seatLimit: workspace.seatLimit,
            activeSeatCount: workspace.activeSeatCount,
            badges: (
              <>
                <RoleBadge value={workspace.role} />
                <StatusBadge value={workspace.status} />
              </>
            ),
          })),
    [isPlatformAdmin, props.workspaces, props.myWorkspaces],
  );

  const organizationOptions = useMemo<OrganizationOption[]>(
    () =>
      organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        detail: describeLicenseUsage(organization.activeSeatCount, organization.seatLimit),
        badges: organization.badges,
      })),
    [organizations],
  );

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === selectedWorkspaceId) ?? null,
    [organizations, selectedWorkspaceId],
  );

  /**
   * Licence pressure for the organization on screen, counted from the members
   * actually loaded rather than the cached `activeSeatCount`, so it moves the
   * moment an invitation is sent or a seat is revoked.
   */
  const licenseUsage = useMemo(
    () => getSeatUsage({ activeSeatCount: summary.seatsUsed, seatLimit: selectedOrganization?.seatLimit ?? null }),
    [summary.seatsUsed, selectedOrganization],
  );

  /**
   * Switching organizations reloads the member list; the flag drives the loading
   * state so the sections below never look empty while that request is in flight.
   */
  const selectOrganization = useCallback(
    async (workspaceId: string) => {
      if (workspaceId === selectedWorkspaceId) return;
      setIsSwitchingOrganization(true);
      try {
        await props.onWorkspaceSelectionChange(workspaceId);
      } finally {
        setIsSwitchingOrganization(false);
      }
    },
    [props, selectedWorkspaceId],
  );

  const handleSort = useCallback(
    (key: MemberSortKey) => {
      if (key === sortKey) {
        setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
        return;
      }
      setSortKey(key);
      setSortDirection(key === "joinedAt" || key === "invitedAt" ? "desc" : "asc");
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

  const toggleRole = useCallback(
    (member: WorkspaceMember) => {
      void props.onUpdateMember(member.id, member.role === "member" ? "admin" : "member", "active");
    },
    [props],
  );

  const reactivate = useCallback(
    (member: WorkspaceMember) => {
      void props.onUpdateMember(member.id, member.role, "active");
    },
    [props],
  );

  const confirmRevoke = useCallback(async () => {
    if (!pendingRevoke) return;
    const target = pendingRevoke;
    setPendingRevoke(null);
    await props.onRevokeMember(target.id);
  }, [pendingRevoke, props]);

  const buildRowActions = useCallback(
    (member: WorkspaceMember): ActionMenuItem[] => {
      const capabilities = getMemberCapabilities(member, isPlatformAdmin);
      const actions: ActionMenuItem[] = [
        { key: "view", label: "View details", icon: "chevronRight", onSelect: () => setDrawerMemberId(member.id) },
        {
          key: "copy-email",
          label: "Copy email",
          icon: "mail",
          onSelect: () => void handleCopy(member.email, "Email"),
        },
        {
          key: "copy-id",
          label: "Copy member ID",
          icon: "copy",
          onSelect: () => void handleCopy(member.id, "Member ID"),
        },
      ];

      if (member.status === "invited") {
        actions.push({
          key: "resend",
          label: "Resend invitation",
          icon: "mailClock",
          disabled: true,
          hint: "No resend endpoint — see details",
          onSelect: () => undefined,
        });
      }

      actions.push({
        key: "toggle-role",
        label: member.role === "member" ? "Make admin" : "Make member",
        icon: "shield",
        disabled: !capabilities.canChangeRole || isBusy,
        hint: capabilities.canChangeRole ? undefined : (capabilities.blockedReason ?? undefined),
        onSelect: () => toggleRole(member),
      });

      if (member.status === "revoked") {
        actions.push({
          key: "reactivate",
          label: "Restore access",
          icon: "check",
          disabled: !capabilities.canReactivate || isBusy,
          hint: capabilities.canReactivate ? undefined : (capabilities.blockedReason ?? undefined),
          onSelect: () => reactivate(member),
        });
      }

      actions.push({
        key: "refresh",
        label: "Refresh member data",
        icon: "refresh",
        disabled: isLoadingDashboard,
        onSelect: onRefreshData,
      });

      actions.push({
        key: "revoke",
        label: member.status === "invited" ? "Revoke invitation" : "Revoke access",
        icon: "ban",
        destructive: true,
        disabled: !capabilities.canRevoke || isBusy,
        hint: capabilities.canRevoke ? undefined : (capabilities.blockedReason ?? undefined),
        onSelect: () => setPendingRevoke(member),
      });

      return actions;
    },
    [handleCopy, isBusy, isLoadingDashboard, isPlatformAdmin, onRefreshData, reactivate, toggleRole],
  );

  // Switching organizations is a member reload too, so it drives the same
  // loading treatment the initial dashboard fetch gets.
  const isLoadingMembers = isLoadingDashboard || isSwitchingOrganization;
  const showSkeleton = isLoadingMembers && scopedMembers.length === 0;
  const hasNoMembersAtAll = !isLoadingMembers && !dashboardError && scopedMembers.length === 0;
  const hasNoMatches = !isLoadingMembers && scopedMembers.length > 0 && sorted.length === 0;
  const organizationName = selectedOrganization?.name ?? null;

  return (
    <section className="space-y-5">
      {/* ======================================= Organization selector */}
      {/* Sticky from `lg` up only: on a phone this card is a third of the
          viewport, and pinning it would leave no room for the members it
          scopes. */}
      <SectionCard
        title="Manage Organization Members"
        description="Choose an organization to manage its members, invitations, roles, and licenses."
        icon="building"
        className="lg:sticky lg:top-[var(--header-height)] lg:z-30"
      >
        {organizations.length === 0 ? (
          <p className="text-[0.8125rem] text-text-muted">
            {isLoadingDashboard
              ? "Loading organizations…"
              : isPlatformAdmin
                ? "No organizations exist yet. Create one from the Workspaces page."
                : "A platform admin must add you to an organization before it appears here."}
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
            <div className="min-w-0">
              <label className="ha-label" htmlFor="members-organization">
                Organization
              </label>
              <OrganizationSelect
                id="members-organization"
                label="Select organization"
                value={selectedWorkspaceId}
                options={organizationOptions}
                onChange={(organizationId) => void selectOrganization(organizationId)}
                describedBy="members-organization-hint"
              />
              <p id="members-organization-hint" className="ha-hint">
                Select an organization to manage its members and invitations.
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-border bg-card-2 px-4 py-3.5">
              <p className="text-[0.8125rem] font-semibold tabular-nums" aria-live="polite">
                {selectedOrganization
                  ? describeLicenseUsage(summary.seatsUsed, selectedOrganization.seatLimit)
                  : "No organization selected"}
              </p>
              {selectedOrganization ? (
                <SeatUsageBar usage={licenseUsage} label={selectedOrganization.name} className="mt-2.5" />
              ) : null}
              <p className="ha-hint">
                Active members and pending invitations count toward the organization&rsquo;s license limit.
              </p>
            </div>
          </div>
        )}

        {organizationName ? (
          <p className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">
            <span className="mt-0.5 shrink-0 text-accent">
              <Icon name="arrowLeft" size={12} className="rotate-[-90deg]" />
            </span>
            Everything below — invitations, members, and licences — belongs to{" "}
            <span className="font-semibold text-foreground">{organizationName}</span>. Changing the organization above
            replaces all of it.
          </p>
        ) : null}
      </SectionCard>

      {/* ========================================= Pending invitations */}
      <SectionCard
        title="Pending Invitations"
        description="People who have been invited but have not joined yet."
        icon="mailClock"
        flush
        action={
          pendingInvitations.length > 0 ? (
            <span className="ha-badge ha-badge-warning">
              {pendingInvitations.length} pending
            </span>
          ) : null
        }
      >
        {showSkeleton ? (
          <ul className="divide-y divide-border">
            {[0, 1].map((row) => (
              <li key={row} className="flex items-center gap-3 px-5 py-3.5">
                <div className="ha-skeleton h-8 w-8 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="ha-skeleton h-3.5 w-52" />
                  <div className="ha-skeleton mt-2 h-3 w-32" />
                </div>
              </li>
            ))}
          </ul>
        ) : pendingInvitations.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="No pending invitations"
            description={
              scopedMembers.length === 0
                ? "Once you invite someone, their pending invitation will appear here until they sign up."
                : "Everyone invited to this organization has already signed up."
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {pendingInvitations.map((member) => {
              const identity = resolveMemberIdentity(member, identityIndex);
              const ageDays = getInvitationAgeDays(member);
              const capabilities = getMemberCapabilities(member, isPlatformAdmin);

              return (
                <li key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-card-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--warning-soft) text-warning">
                    <Icon name="mailClock" size={15} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setDrawerMemberId(member.id)}
                      aria-label={`View invitation details for ${identity.email}`}
                      className="ha-tap-target block max-w-full truncate text-left text-[0.8125rem] font-medium transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {identity.email}
                    </button>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Sent {formatDateTime(member.createdAt)}
                      {ageDays !== null
                        ? ` · ${ageDays === 0 ? "today" : `${ageDays} day${ageDays === 1 ? "" : "s"} ago`}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <RoleBadge value={member.role} />
                    <StatusBadge value={member.status} />
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopy(member.email, "Email")}
                      aria-label={`Copy email address for ${identity.email}`}
                      className="ha-btn ha-btn-secondary ha-btn-sm"
                    >
                      <Icon name="copy" size={13} />
                      Copy
                    </button>
                    <button
                      type="button"
                      disabled
                      title={unsupportedMemberActions.resendInvitation}
                      aria-label={`Resend invitation to ${identity.email} — unavailable`}
                      className="ha-btn ha-btn-secondary ha-btn-sm"
                    >
                      <Icon name="mailClock" size={13} />
                      Resend
                    </button>
                    <button
                      type="button"
                      disabled={!capabilities.canRevoke || isBusy}
                      onClick={() => setPendingRevoke(member)}
                      aria-label={`Revoke invitation for ${identity.email}`}
                      title={capabilities.canRevoke ? "Revoke invitation" : (capabilities.blockedReason ?? undefined)}
                      className="ha-btn ha-btn-danger ha-btn-sm"
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {pendingInvitations.length > 0 ? (
          <p className="flex items-start gap-2 border-t border-border px-5 py-3 text-xs leading-relaxed text-text-subtle">
            <span className="mt-0.5 shrink-0">
              <Icon name="lock" size={12} />
            </span>
            {unsupportedMemberActions.resendInvitation} Pending invitations still consume a seat.
          </p>
        ) : null}
      </SectionCard>

      {/* ================================================ Invite form */}
      <SectionCard
        title="Invite a Member"
        description="Send an invitation to give someone access to this organization."
        icon="userPlus"
      >
        <form className="grid gap-3.5 md:grid-cols-[2fr_1fr_auto] md:items-end" onSubmit={props.onAddMember}>
          <div>
            <label className="ha-label" htmlFor="members-invite-email">
              Email
            </label>
            <input
              id="members-invite-email"
              value={props.memberEmail}
              onChange={(e) => props.setMemberEmail(e.target.value)}
              className="ha-input"
              placeholder="member@clinic.com"
              type="email"
              required
            />
          </div>
          <div>
            <label className="ha-label" htmlFor="members-invite-role">
              Role
            </label>
            <select
              id="members-invite-role"
              value={props.memberRole}
              onChange={(e) => props.setMemberRole(e.target.value)}
              className="ha-input"
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!selectedWorkspaceId || isBusy}
            className="ha-btn ha-btn-primary h-[38px]"
          >
            <Icon name="userPlus" size={14} />
            {isBusy ? "Working…" : "Invite"}
          </button>
        </form>
        {!selectedWorkspaceId ? (
          <p className="mt-3 text-xs text-text-subtle">Select an organization above to enable invitations.</p>
        ) : null}
      </SectionCard>

      {/* =================================================== Directory */}
      <SectionCard
        title="Organization Members"
        description="People who currently have access to this organization."
        icon="users"
        flush
        action={
          <span className="ha-badge ha-badge-neutral">
            {sorted.length === scopedMembers.length
              ? `${scopedMembers.length} ${scopedMembers.length === 1 ? "member" : "members"}`
              : `${sorted.length} of ${scopedMembers.length}`}
          </span>
        }
      >
        {/* Summary strip */}
        {scopedMembers.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-5 py-3">
            <StatChip label="active" value={summary.active} tone="ha-badge-success" />
            <StatChip label="invited" value={summary.invited} tone="ha-badge-warning" />
            <StatChip label="revoked" value={summary.revoked} tone="ha-badge-danger" />
            <span className="text-xs text-text-subtle">
              {summary.seatsUsed} {summary.seatsUsed === 1 ? "license" : "licenses"} in use (active + invited)
            </span>
          </div>
        ) : null}

        {/* Toolbar */}
        <div className="border-b border-border px-5 py-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={filters.search}
              onChange={(search) => setFilters((current) => ({ ...current, search }))}
              placeholder="Search by name, email, or role…"
              label="Search members by name, email, or role"
              resultsLabel={`${sorted.length} members match the current filters`}
              className="lg:max-w-xs lg:flex-1"
            />

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <FilterSelect
                id="filter-member-status"
                label="Filter by member status"
                value={filters.status}
                options={statusFilterOptions}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
              <FilterSelect
                id="filter-member-role"
                label="Filter by role"
                value={filters.role}
                options={roleFilterOptions}
                onChange={(role) => setFilters((current) => ({ ...current, role }))}
              />
              <FilterSelect
                id="filter-member-seat"
                label="Filter by seat occupancy"
                value={filters.seat}
                options={seatFilterOptions}
                onChange={(seat) => setFilters((current) => ({ ...current, seat }))}
              />

              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilters(defaultMemberFilters)}
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
          <div role="alert" className="flex items-start gap-3 bg-(--danger-soft) px-5 py-4">
            <span className="mt-0.5 text-danger">
              <Icon name="alert" size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-semibold text-danger">Could not load members</p>
              <p className="mt-1 text-xs leading-relaxed text-danger opacity-90">{dashboardError}</p>
            </div>
            <button type="button" onClick={onRefreshData} className="ha-btn ha-btn-secondary ha-btn-sm">
              <Icon name="refresh" size={13} />
              Retry
            </button>
          </div>
        ) : null}

        {/* Loading */}
        {showSkeleton ? (
          <ul className="divide-y divide-border">
            {[0, 1, 2, 3, 4].map((row) => (
              <li key={row} className="flex items-center gap-3 px-5 py-3.5">
                <div className="ha-skeleton h-8 w-8 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="ha-skeleton h-3.5 w-40" />
                  <div className="ha-skeleton mt-2 h-3 w-56" />
                </div>
                <div className="ha-skeleton hidden h-5 w-16 rounded-full md:block" />
                <div className="ha-skeleton hidden h-5 w-16 rounded-full md:block" />
              </li>
            ))}
          </ul>
        ) : null}

        {/* Empty states */}
        {hasNoMembersAtAll ? (
          <EmptyState
            icon="users"
            title={selectedWorkspaceId ? "No members yet" : "No organization selected"}
            description={
              selectedWorkspaceId
                ? "Invite someone by email above — the licence activates automatically when they sign up."
                : "Select an organization to view and manage its members."
            }
          />
        ) : null}

        {hasNoMatches ? (
          <EmptyState
            icon="search"
            title="No members match your filters"
            description="Try a different search term, or reset the filters to see every seat."
            action={
              <button
                type="button"
                onClick={() => setFilters(defaultMemberFilters)}
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
            <div className="ha-scroll hidden max-h-[calc(100vh-26rem)] overflow-auto md:block">
              <table className="ha-table ha-table-zebra">
                <caption className="sr-only">
                  Members of {organizationName ?? "the selected organization"}. {sorted.length} of{" "}
                  {scopedMembers.length} shown, sorted by {sortKey} {sortDirection}ending.
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
                    <th scope="col">Seat</th>
                    <th
                      scope="col"
                      aria-sort={
                        sortKey === "invitedAt" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                      }
                    >
                      <SortButton
                        label="Invited"
                        columnKey="invitedAt"
                        activeKey={sortKey}
                        direction={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        sortKey === "joinedAt" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                      }
                    >
                      <SortButton
                        label="Joined"
                        columnKey="joinedAt"
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
                  {pageData.rows.map((member) => {
                    const identity = resolveMemberIdentity(member, identityIndex);
                    const hasSeat = occupiesSeat(member);

                    return (
                      <tr
                        key={member.id}
                        tabIndex={0}
                        aria-label={`${identity.displayName}, ${identity.email}, ${member.role}, ${member.status}. Press Enter to view details.`}
                        onClick={() => setDrawerMemberId(member.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setDrawerMemberId(member.id);
                          }
                        }}
                        className="ha-table-row-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                      >
                        <td>
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={identity.displayName}
                              size="sm"
                              tone={member.role === "owner" ? "accent" : "neutral"}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{identity.displayName}</span>
                              <span className="block truncate text-xs text-text-muted">{identity.email}</span>
                            </span>
                          </div>
                        </td>
                        <td>
                          <RoleBadge value={member.role} />
                        </td>
                        <td>
                          <StatusBadge value={member.status} />
                        </td>
                        <td>
                          <span className={`ha-badge ${hasSeat ? "ha-badge-success" : "ha-badge-neutral"}`}>
                            {hasSeat ? "Has seat" : "No seat"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap text-text-muted">{formatDateTime(member.createdAt)}</td>
                        <td className="whitespace-nowrap text-text-muted">
                          {member.joinedAt ? (
                            formatDateTime(member.joinedAt)
                          ) : (
                            <span className="text-text-subtle">Not joined</span>
                          )}
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end">
                            <ActionMenu
                              items={buildRowActions(member)}
                              label={`Actions for ${identity.displayName}`}
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
            <ul className="divide-y divide-border md:hidden">
              {pageData.rows.map((member) => {
                const identity = resolveMemberIdentity(member, identityIndex);
                const hasSeat = occupiesSeat(member);

                return (
                  <li key={member.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <Avatar
                        name={identity.displayName}
                        size="md"
                        tone={member.role === "owner" ? "accent" : "neutral"}
                      />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setDrawerMemberId(member.id)}
                          aria-label={`View details for ${identity.displayName}`}
                          className="ha-tap-target block max-w-full truncate text-left text-[0.875rem] font-semibold transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {identity.displayName}
                        </button>
                        <p className="mt-0.5 truncate text-xs text-text-muted">{identity.email}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <RoleBadge value={member.role} />
                          <StatusBadge value={member.status} />
                          <span className={`ha-badge ${hasSeat ? "ha-badge-success" : "ha-badge-neutral"}`}>
                            {hasSeat ? "Has seat" : "No seat"}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-text-subtle">
                          {member.joinedAt
                            ? `Joined ${formatDateTime(member.joinedAt)}`
                            : `Invited ${formatDateTime(member.createdAt)}`}
                        </p>
                      </div>
                      <ActionMenu items={buildRowActions(member)} label={`Actions for ${identity.displayName}`} />
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setDrawerMemberId(member.id)}
                        className="ha-btn ha-btn-secondary ha-btn-sm flex-1"
                      >
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopy(member.email, "Email")}
                        aria-label={`Copy email address for ${identity.displayName}`}
                        className="ha-btn ha-btn-secondary ha-btn-sm flex-1"
                      >
                        <Icon name="copy" size={13} />
                        Copy email
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
              itemLabel="member"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : null}
      </SectionCard>

      {/* ==================================================== Overlays */}
      <MemberDetailDrawer
        member={drawerMember}
        workspace={selectedWorkspace}
        identityIndex={identityIndex}
        isPlatformAdmin={isPlatformAdmin}
        isBusy={isBusy}
        onClose={() => setDrawerMemberId(null)}
        onCopy={(value, label) => void handleCopy(value, label)}
        onToggleRole={toggleRole}
        onRevoke={(member) => setPendingRevoke(member)}
        onReactivate={reactivate}
      />

      <ConfirmDialog
        open={pendingRevoke !== null}
        title={pendingRevoke?.status === "invited" ? "Revoke this invitation?" : "Revoke workspace access?"}
        description={
          pendingRevoke?.status === "invited"
            ? `${pendingRevoke?.email ?? ""} will no longer be able to claim this seat, and the seat is returned to the workspace.`
            : `${pendingRevoke?.email ?? ""} will immediately lose Pro access through this workspace, and the seat is returned.`
        }
        warning="The membership row is retained as revoked. Re-inviting the same email later restores the seat and sends a fresh invitation email."
        confirmLabel={pendingRevoke?.status === "invited" ? "Revoke invitation" : "Revoke access"}
        icon="ban"
        tone="danger"
        isBusy={isBusy}
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setPendingRevoke(null)}
      />
    </section>
  );
}
