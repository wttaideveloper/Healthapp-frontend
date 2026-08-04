import type { AdminUser, Workspace } from "@/types/admin";

/**
 * Pure helpers for the Users view.
 *
 * All of this runs client-side over the array already returned by
 * `GET /api/v1/admin/users` — there is no backend search, filter, sort, or
 * pagination endpoint and none is introduced here.
 *
 * Backend vocabulary (see `src/db/schema/enums.ts` in the API):
 *   role   = "user" | "admin"          -> the spec's "Member" is `user`
 *   status = "pending" | "active"      -> there is NO "disabled" status
 */

export type RoleFilter = "all" | "admin" | "user";
export type StatusFilter = "all" | "active" | "pending";
export type AccessFilter = "all" | "has-access" | "no-access";

export type UserSortKey = "name" | "email" | "createdAt" | "role";
export type SortDirection = "asc" | "desc";

export type UserFilterState = {
  search: string;
  role: RoleFilter;
  status: StatusFilter;
  access: AccessFilter;
};

export const defaultUserFilters: UserFilterState = {
  search: "",
  role: "all",
  status: "all",
  access: "all",
};

export const pageSizeOptions = [25, 50, 100] as const;
export type PageSize = (typeof pageSizeOptions)[number];

export function isPageSize(value: unknown): value is PageSize {
  return typeof value === "number" && (pageSizeOptions as readonly number[]).includes(value);
}

export function countActiveFilters(filters: UserFilterState): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.role !== "all") count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.access !== "all") count += 1;
  return count;
}

/** Case-insensitive substring match across name and email. */
function matchesSearch(user: AdminUser, needle: string): boolean {
  if (!needle) return true;
  return user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle);
}

export function filterUsers(users: AdminUser[], filters: UserFilterState): AdminUser[] {
  const needle = filters.search.trim().toLowerCase();

  // Skip the walk entirely when nothing is narrowed.
  if (!needle && filters.role === "all" && filters.status === "all" && filters.access === "all") {
    return users;
  }

  return users.filter((user) => {
    if (!matchesSearch(user, needle)) return false;
    if (filters.role !== "all" && user.role !== filters.role) return false;
    if (filters.status !== "all" && user.status !== filters.status) return false;
    if (filters.access === "has-access" && !user.hasAccess) return false;
    if (filters.access === "no-access" && user.hasAccess) return false;
    return true;
  });
}

/** Admins sort above users so role ordering reads as a privilege ranking. */
const roleWeight: Record<string, number> = { admin: 0, user: 1 };

function compareUsers(a: AdminUser, b: AdminUser, key: UserSortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    case "email":
      return a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
    case "role": {
      const diff = (roleWeight[a.role] ?? 99) - (roleWeight[b.role] ?? 99);
      return diff !== 0 ? diff : a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
    case "createdAt": {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      const safeA = Number.isFinite(aTime) ? aTime : 0;
      const safeB = Number.isFinite(bTime) ? bTime : 0;
      return safeA - safeB;
    }
    default:
      return 0;
  }
}

export function sortUsers(users: AdminUser[], key: UserSortKey, direction: SortDirection): AdminUser[] {
  // Copy first: the input is React state and must not be mutated.
  const sorted = [...users].sort((a, b) => compareUsers(a, b, key));
  return direction === "asc" ? sorted : sorted.reverse();
}

export type PaginationResult<T> = {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
};

export function paginate<T>(rows: T[], page: number, pageSize: number): PaginationResult<T> {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Clamp so deleting/filtering rows can never strand the view on a dead page.
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return {
    rows: slice,
    page: safePage,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}

/**
 * Workspaces this user owns, derived from the already-loaded
 * `GET /api/v1/admin/workspaces` response.
 *
 * BACKEND LIMITATION: ownership is the only relationship visible here.
 * Non-owner memberships live in per-workspace member lists, so a full
 * "workspaces joined" count would need an N+1 fan-out or a new API field.
 */
export function findOwnedWorkspaces(user: AdminUser, workspaces: Workspace[]): Workspace[] {
  const email = user.email.trim().toLowerCase();
  return workspaces.filter(
    (workspace) => workspace.ownerUserId === user.id || workspace.ownerEmail.trim().toLowerCase() === email,
  );
}

export function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}
