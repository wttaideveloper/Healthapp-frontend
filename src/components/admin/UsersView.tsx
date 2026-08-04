"use client";

import { FormEvent, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";

import { UserDetailDrawer } from "@/components/admin/UserDetailDrawer";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FilterSelect, type FilterOption } from "@/components/ui/FilterSelect";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState, SectionCard } from "@/components/ui/Section";
import { RoleBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import { copyToClipboard } from "@/lib/admin/clipboard";
import { formatDateTime } from "@/lib/format";
import {
  countActiveFilters,
  defaultUserFilters,
  filterUsers,
  isPageSize,
  paginate,
  sortUsers,
  type AccessFilter,
  type PageSize,
  type RoleFilter,
  type SortDirection,
  type StatusFilter,
  type UserSortKey,
} from "@/lib/admin/users";
import type { AdminUser, Workspace } from "@/types/admin";

type UsersViewProps = {
  users: AdminUser[];
  workspaces: Workspace[];
  isLoadingDashboard: boolean;
  dashboardError: string | null;
  isBusy: boolean;
  onRefreshData: () => void;
  onNotify: (type: "success" | "error", message: string) => void;
  /** Reuses `POST admin/users/promote-admin`. Null when unsupported for this session. */
  onPromoteUserToAdmin: ((email: string) => Promise<void>) | null;
  // Existing "Create Admin User" form — preserved verbatim.
  newAdminName: string;
  setNewAdminName: (value: string) => void;
  newAdminEmail: string;
  setNewAdminEmail: (value: string) => void;
  newAdminPassword: string;
  setNewAdminPassword: (value: string) => void;
  onCreateAdmin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

const roleOptions: ReadonlyArray<FilterOption<RoleFilter>> = [
  { value: "all", label: "All roles" },
  { value: "admin", label: "Admin" },
  // Backend role is `user`; the product spec calls this a "member".
  { value: "user", label: "User" },
];

const statusOptions: ReadonlyArray<FilterOption<StatusFilter>> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
];

const accessOptions: ReadonlyArray<FilterOption<AccessFilter>> = [
  { value: "all", label: "All access" },
  { value: "has-access", label: "Has access" },
  { value: "no-access", label: "No access" },
];

const sortableColumns: Array<{ key: UserSortKey; label: string; className?: string }> = [
  { key: "name", label: "User" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
];

function SortButton({
  label,
  columnKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  columnKey: UserSortKey;
  activeKey: UserSortKey;
  direction: SortDirection;
  onSort: (key: UserSortKey) => void;
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

export function UsersView(props: UsersViewProps) {
  const { users, isLoadingDashboard, dashboardError, isBusy, onNotify, onRefreshData } = props;

  const [filters, setFilters] = useState(defaultUserFilters);
  const [sortKey, setSortKey] = useState<UserSortKey>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useLocalStorageState<PageSize>("healthage.admin.users.pageSize", 25, isPageSize);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<AdminUser | null>(null);

  // Keeps typing responsive: the input updates immediately while the (heavier)
  // filter + sort pass runs against a deferred value.
  const deferredSearch = useDeferredValue(filters.search);
  const effectiveFilters = useMemo(
    () => ({ ...filters, search: deferredSearch }),
    [filters, deferredSearch],
  );

  const filtered = useMemo(() => filterUsers(users, effectiveFilters), [users, effectiveFilters]);
  const sorted = useMemo(() => sortUsers(filtered, sortKey, sortDirection), [filtered, sortKey, sortDirection]);
  const pageData = useMemo(() => paginate(sorted, page, pageSize), [sorted, page, pageSize]);

  const activeFilterCount = useMemo(() => countActiveFilters(effectiveFilters), [effectiveFilters]);

  // Narrowing the result set can strand the viewport past the last page.
  useEffect(() => {
    if (page !== pageData.page) setPage(pageData.page);
  }, [page, pageData.page]);

  // Any change to the result set returns the reader to the first page.
  useEffect(() => {
    setPage(1);
  }, [effectiveFilters, sortKey, sortDirection, pageSize]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const handleSort = useCallback(
    (key: UserSortKey) => {
      if (key === sortKey) {
        setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
        return;
      }
      setSortKey(key);
      // Dates read best newest-first; text reads best A→Z.
      setSortDirection(key === "createdAt" ? "desc" : "asc");
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

  const promoteUserToAdmin = props.onPromoteUserToAdmin;
  const confirmPromotion = useCallback(async () => {
    if (!pendingPromotion || !promoteUserToAdmin) return;
    const target = pendingPromotion;
    setPendingPromotion(null);
    await promoteUserToAdmin(target.email);
  }, [pendingPromotion, promoteUserToAdmin]);

  const buildRowActions = useCallback(
    (user: AdminUser): ActionMenuItem[] => {
      const actions: ActionMenuItem[] = [
        {
          key: "view",
          label: "View details",
          icon: "chevronRight",
          onSelect: () => setSelectedUserId(user.id),
        },
        {
          key: "copy-email",
          label: "Copy email",
          icon: "copy",
          onSelect: () => void handleCopy(user.email, "Email"),
        },
        {
          key: "copy-id",
          label: "Copy user ID",
          icon: "copy",
          onSelect: () => void handleCopy(user.id, "User ID"),
        },
      ];

      if (promoteUserToAdmin) {
        actions.push({
          key: "promote",
          label: "Promote to admin",
          icon: "shield",
          disabled: user.role === "admin" || isBusy,
          hint: user.role === "admin" ? "Already an admin" : "Cannot be undone here",
          onSelect: () => setPendingPromotion(user),
        });
      }

      actions.push({
        key: "refresh",
        label: "Refresh user data",
        icon: "refresh",
        disabled: isLoadingDashboard,
        onSelect: onRefreshData,
      });

      return actions;
    },
    [handleCopy, isBusy, isLoadingDashboard, promoteUserToAdmin, onRefreshData],
  );

  const showSkeleton = isLoadingDashboard && users.length === 0;
  const hasNoUsersAtAll = !isLoadingDashboard && !dashboardError && users.length === 0;
  const hasNoMatches = !isLoadingDashboard && users.length > 0 && sorted.length === 0;

  return (
    <section className="space-y-5">
      {/* ================================================ Create admin */}
      <SectionCard
        title="Create Admin User"
        description="Administrators can manage every workspace on the platform"
        icon="shield"
      >
        <form className="grid gap-3.5 md:grid-cols-4 md:items-end" onSubmit={props.onCreateAdmin}>
          <div>
            <label className="ha-label" htmlFor="admin-name">
              Name
            </label>
            <input
              id="admin-name"
              value={props.newAdminName}
              onChange={(e) => props.setNewAdminName(e.target.value)}
              className="ha-input"
              placeholder="Regional Admin"
              pattern="[A-Za-z][A-Za-z0-9 ]*"
              title="Name must start with a letter and can include letters, numbers, and spaces."
              required
            />
          </div>
          <div>
            <label className="ha-label" htmlFor="admin-email">
              Email
            </label>
            <input
              id="admin-email"
              value={props.newAdminEmail}
              onChange={(e) => props.setNewAdminEmail(e.target.value)}
              className="ha-input"
              placeholder="admin@conference.org"
              type="email"
              required
            />
          </div>
          <div>
            <label className="ha-label" htmlFor="admin-password">
              Password
            </label>
            <PasswordInput
              id="admin-password"
              value={props.newAdminPassword}
              onChange={(e) => props.setNewAdminPassword(e.target.value)}
              className="ha-input"
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              required
            />
          </div>
          <button type="submit" disabled={isBusy} className="ha-btn ha-btn-primary h-[38px]">
            <Icon name="shield" size={14} />
            {isBusy ? "Working…" : "Create Admin"}
          </button>
        </form>
      </SectionCard>

      {/* ================================================== Directory */}
      <SectionCard
        title="Users Directory"
        description="Search, filter, and inspect every account on the platform"
        icon="users"
        flush
        action={
          <span className="ha-badge ha-badge-neutral">
            {sorted.length === users.length
              ? `${users.length} ${users.length === 1 ? "user" : "users"}`
              : `${sorted.length} of ${users.length}`}
          </span>
        }
      >
        {/* Toolbar */}
        <div className="border-b border-[color:var(--border)] px-5 py-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <SearchInput
              value={filters.search}
              onChange={(search) => setFilters((current) => ({ ...current, search }))}
              placeholder="Search by name or email…"
              label="Search users by name or email"
              resultsLabel={`${sorted.length} users match the current filters`}
              className="lg:max-w-xs lg:flex-1"
            />

            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <FilterSelect
                id="filter-role"
                label="Filter by role"
                value={filters.role}
                options={roleOptions}
                onChange={(role) => setFilters((current) => ({ ...current, role }))}
              />
              <FilterSelect
                id="filter-status"
                label="Filter by status"
                value={filters.status}
                options={statusOptions}
                onChange={(status) => setFilters((current) => ({ ...current, status }))}
              />
              <FilterSelect
                id="filter-access"
                label="Filter by subscription access"
                value={filters.access}
                options={accessOptions}
                onChange={(access) => setFilters((current) => ({ ...current, access }))}
              />

              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilters(defaultUserFilters)}
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
              <p className="text-[0.8125rem] font-semibold text-[color:var(--danger)]">Could not load users</p>
              <p className="mt-1 text-xs leading-relaxed text-[color:var(--danger)] opacity-90">{dashboardError}</p>
            </div>
            <button type="button" onClick={props.onRefreshData} className="ha-btn ha-btn-secondary ha-btn-sm">
              <Icon name="refresh" size={13} />
              Retry
            </button>
          </div>
        ) : null}

        {/* Loading skeleton */}
        {showSkeleton ? (
          <ul className="divide-y divide-[color:var(--border)]">
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
        {hasNoUsersAtAll ? (
          <EmptyState
            icon="users"
            title="No users yet"
            description="Accounts appear here once people register in the HealthAge app."
          />
        ) : null}

        {hasNoMatches ? (
          <EmptyState
            icon="search"
            title="No users match your filters"
            description="Try a different search term, or reset the filters to see every account."
            action={
              <button type="button" onClick={() => setFilters(defaultUserFilters)} className="ha-btn ha-btn-secondary">
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
            <div className="ha-scroll hidden max-h-[calc(100vh-22rem)] overflow-auto md:block">
              <table className="ha-table ha-table-zebra">
                <caption className="sr-only">
                  Platform users. {sorted.length} of {users.length} shown, sorted by {sortKey} {sortDirection}ending.
                </caption>
                <thead>
                  <tr>
                    {sortableColumns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={
                          sortKey === column.key
                            ? sortDirection === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
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
                    <th scope="col">Access</th>
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
                  {pageData.rows.map((user) => (
                    <tr
                      key={user.id}
                      tabIndex={0}
                      aria-label={`${user.name}, ${user.email}. Press Enter to view details.`}
                      onClick={() => setSelectedUserId(user.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedUserId(user.id);
                        }
                      }}
                      className="ha-table-row-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)]"
                    >
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={user.name} size="sm" tone={user.role === "admin" ? "accent" : "neutral"} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{user.name}</span>
                            {!user.isEmailVerified ? (
                              <span className="block text-xs text-[color:var(--text-subtle)]">Unverified email</span>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="text-[color:var(--text-muted)]">
                        <span className="truncate">{user.email}</span>
                      </td>
                      <td>
                        <RoleBadge value={user.role} />
                      </td>
                      <td>
                        <StatusBadge value={user.status} />
                      </td>
                      <td>
                        <span className={`ha-badge ${user.hasAccess ? "ha-badge-success" : "ha-badge-neutral"}`}>
                          {user.hasAccess ? "Has access" : "No access"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-[color:var(--text-muted)]">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <div className="flex justify-end">
                          <ActionMenu items={buildRowActions(user)} label={`Actions for ${user.name}`} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-[color:var(--border)] md:hidden">
              {pageData.rows.map((user) => (
                <li key={user.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={user.name} size="md" tone={user.role === "admin" ? "accent" : "neutral"} />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        aria-label={`View details for ${user.name}`}
                        className="block max-w-full truncate text-left text-[0.875rem] font-semibold transition-colors hover:text-[color:var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
                      >
                        {user.name}
                      </button>
                      <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">{user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <RoleBadge value={user.role} />
                        <StatusBadge value={user.status} />
                        <span className={`ha-badge ${user.hasAccess ? "ha-badge-success" : "ha-badge-neutral"}`}>
                          {user.hasAccess ? "Has access" : "No access"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[color:var(--text-subtle)]">
                        Created {formatDateTime(user.createdAt)}
                      </p>
                    </div>
                    <ActionMenu items={buildRowActions(user)} label={`Actions for ${user.name}`} />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      className="ha-btn ha-btn-secondary ha-btn-sm flex-1"
                    >
                      View details
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy(user.email, "Email")}
                      aria-label={`Copy email address for ${user.name}`}
                      className="ha-btn ha-btn-secondary ha-btn-sm flex-1"
                    >
                      <Icon name="copy" size={13} />
                      Copy email
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={pageData.page}
              pageCount={pageData.pageCount}
              pageSize={pageSize}
              from={pageData.from}
              to={pageData.to}
              total={pageData.total}
              itemLabel="user"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : null}
      </SectionCard>

      {/* =================================================== Overlays */}
      <UserDetailDrawer
        user={selectedUser}
        workspaces={props.workspaces}
        canManage={props.onPromoteUserToAdmin !== null}
        isBusy={isBusy}
        onClose={() => setSelectedUserId(null)}
        onCopy={(value, label) => void handleCopy(value, label)}
        onPromote={props.onPromoteUserToAdmin ? (user) => setPendingPromotion(user) : null}
      />

      <ConfirmDialog
        open={pendingPromotion !== null}
        title="Promote to platform admin?"
        description={`${pendingPromotion?.name ?? ""} (${pendingPromotion?.email ?? ""}) will gain full access to every workspace, user, and entitlement on the platform.`}
        warning="The API exposes no demotion endpoint — this cannot be reversed from the admin console."
        confirmLabel="Promote to admin"
        icon="shield"
        isBusy={isBusy}
        onConfirm={() => void confirmPromotion()}
        onCancel={() => setPendingPromotion(null)}
      />
    </section>
  );
}
