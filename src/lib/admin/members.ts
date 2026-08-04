import type { AdminUser, Workspace, WorkspaceMember } from "@/types/admin";
import type { IconName } from "@/components/ui/Icon";

/**
 * Pure helpers for the Members & Invitations view.
 *
 * Everything runs client-side over the member array already returned by
 * `GET admin/workspaces/:id` (platform admin) or `GET workspaces/:id/members`
 * (workspace owner/admin). No backend search/filter/sort endpoint exists.
 *
 * Backend vocabulary (`workspace.util.ts`):
 *   role   = "owner" | "admin" | "member"
 *   status = "invited" | "active" | "revoked"
 *
 * SEAT SEMANTICS: `getActiveSeatCount` counts members whose status is
 * NOT "revoked" — so a pending invitation consumes a seat exactly like an
 * active member does. "Has seat" below mirrors that rule precisely.
 */

export type MemberStatusFilter = "all" | "active" | "invited" | "revoked";
export type MemberRoleFilter = "all" | "owner" | "admin" | "member";
export type MemberSeatFilter = "all" | "has-seat" | "no-seat";

export type MemberSortKey = "name" | "email" | "role" | "status" | "joinedAt" | "invitedAt";
export type SortDirection = "asc" | "desc";

export type MemberFilterState = {
  search: string;
  status: MemberStatusFilter;
  role: MemberRoleFilter;
  seat: MemberSeatFilter;
};

export const defaultMemberFilters: MemberFilterState = {
  search: "",
  status: "all",
  role: "all",
  seat: "all",
};

export function countActiveMemberFilters(filters: MemberFilterState): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.role !== "all") count += 1;
  if (filters.seat !== "all") count += 1;
  return count;
}

/** Mirrors the backend's seat rule: anything not revoked occupies a seat. */
export function occupiesSeat(member: WorkspaceMember): boolean {
  return member.status !== "revoked";
}

/* ------------------------------------------------------------- identity */

export type MemberIdentityIndex = {
  byId: Map<string, AdminUser>;
  byEmail: Map<string, AdminUser>;
};

export function buildMemberIdentityIndex(users: AdminUser[]): MemberIdentityIndex {
  const byId = new Map<string, AdminUser>();
  const byEmail = new Map<string, AdminUser>();
  for (const user of users) {
    byId.set(user.id, user);
    byEmail.set(user.email.trim().toLowerCase(), user);
  }
  return { byId, byEmail };
}

export type MemberIdentity = {
  /** Registered account name, or null when the invite has not been claimed. */
  name: string | null;
  /** Always renderable: the account name, else the email local-part. */
  displayName: string;
  email: string;
  user: AdminUser | null;
};

/**
 * Member rows carry only an email and an optional `userId`.
 *
 * BACKEND LIMITATION: no name is returned. Names are cross-referenced from the
 * already-loaded `admin/users` list, which is only populated for platform
 * admins — workspace admins cannot call that endpoint, so they see the email
 * local-part instead. A `name` field on `memberResponseSchema` would remove this.
 */
export function resolveMemberIdentity(member: WorkspaceMember, index: MemberIdentityIndex): MemberIdentity {
  const email = member.email.trim();
  const byId = member.userId ? index.byId.get(member.userId) : undefined;
  const user = byId ?? index.byEmail.get(email.toLowerCase()) ?? null;
  const localPart = email.split("@")[0] || email;
  return { name: user?.name ?? null, displayName: user?.name ?? localPart, email, user };
}

/* ---------------------------------------------------------- capabilities */

export type MemberCapabilities = {
  canChangeRole: boolean;
  canRevoke: boolean;
  canReactivate: boolean;
  /** Why an action is unavailable, for tooltips and disabled hints. */
  blockedReason: string | null;
};

/**
 * What the API will actually accept for this member.
 *
 * Platform admin (`admin/workspaces/...`): may change any role, but revoking an
 * owner is rejected with "Transfer ownership before revoking the owner".
 * Workspace owner/admin (`workspaces/...`): rejected outright on owner rows with
 * "Workspace owner can only be changed by a platform admin".
 */
export function getMemberCapabilities(member: WorkspaceMember, isPlatformAdmin: boolean): MemberCapabilities {
  const isOwner = member.role === "owner";

  if (isOwner && !isPlatformAdmin) {
    return {
      canChangeRole: false,
      canRevoke: false,
      canReactivate: false,
      blockedReason: "Only a platform admin can change the workspace owner",
    };
  }

  if (isOwner) {
    return {
      canChangeRole: true,
      canRevoke: false,
      canReactivate: member.status === "revoked",
      blockedReason: "Transfer ownership before revoking the owner",
    };
  }

  return {
    canChangeRole: true,
    canRevoke: member.status !== "revoked",
    canReactivate: member.status === "revoked",
    blockedReason: null,
  };
}

/**
 * Actions the API has no endpoint for. Surfaced as disabled controls with an
 * explanation rather than silently omitted, so admins know the limit is the
 * backend and not a permission problem.
 */
export const unsupportedMemberActions = {
  resendInvitation:
    "No resend endpoint. Re-inviting an existing member returns 409 Conflict; only a revoked seat can be re-added.",
  removeMember: "DELETE performs a soft revoke — the row is retained and no hard-delete endpoint exists.",
  transferOwnership: "No ownership-transfer endpoint. Owner reassignment also requires updating the workspace record.",
  invitationLink: "Invitations are email-only; the API returns no per-invite token or link.",
} as const;

/* --------------------------------------------------------------- filtering */

function matchesSearch(member: WorkspaceMember, identity: MemberIdentity, needle: string): boolean {
  if (!needle) return true;
  if (identity.email.toLowerCase().includes(needle)) return true;
  if (identity.name && identity.name.toLowerCase().includes(needle)) return true;
  if (member.role.toLowerCase().includes(needle)) return true;
  return false;
}

export function filterMembers(
  members: WorkspaceMember[],
  filters: MemberFilterState,
  index: MemberIdentityIndex,
): WorkspaceMember[] {
  const needle = filters.search.trim().toLowerCase();

  if (!needle && filters.status === "all" && filters.role === "all" && filters.seat === "all") {
    return members;
  }

  return members.filter((member) => {
    if (filters.status !== "all" && member.status !== filters.status) return false;
    if (filters.role !== "all" && member.role !== filters.role) return false;
    if (filters.seat === "has-seat" && !occupiesSeat(member)) return false;
    if (filters.seat === "no-seat" && occupiesSeat(member)) return false;
    if (needle && !matchesSearch(member, resolveMemberIdentity(member, index), needle)) return false;
    return true;
  });
}

/* ----------------------------------------------------------------- sorting */

const roleWeight: Record<string, number> = { owner: 0, admin: 1, member: 2 };
const statusWeight: Record<string, number> = { active: 0, invited: 1, revoked: 2 };

function timeOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Nulls (never joined) sort last in both directions rather than as epoch 0. */
function compareNullableTime(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareMembers(
  a: WorkspaceMember,
  b: WorkspaceMember,
  key: MemberSortKey,
  index: MemberIdentityIndex,
): number {
  switch (key) {
    case "name": {
      const nameA = resolveMemberIdentity(a, index).displayName;
      const nameB = resolveMemberIdentity(b, index).displayName;
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    }
    case "email":
      return a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
    case "role": {
      const diff = (roleWeight[a.role] ?? 9) - (roleWeight[b.role] ?? 9);
      return diff !== 0 ? diff : a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
    }
    case "status": {
      const diff = (statusWeight[a.status] ?? 9) - (statusWeight[b.status] ?? 9);
      return diff !== 0 ? diff : a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
    }
    case "joinedAt":
      return compareNullableTime(timeOf(a.joinedAt), timeOf(b.joinedAt));
    case "invitedAt":
      // The member row is created at invitation time.
      return (timeOf(a.createdAt) ?? 0) - (timeOf(b.createdAt) ?? 0);
    default:
      return 0;
  }
}

export function sortMembers(
  members: WorkspaceMember[],
  key: MemberSortKey,
  direction: SortDirection,
  index: MemberIdentityIndex,
): WorkspaceMember[] {
  const sorted = [...members].sort((a, b) => compareMembers(a, b, key, index));

  if (direction === "asc") return sorted;

  // Reversing would drag "never joined" rows to the front; keep them pinned last.
  if (key === "joinedAt") {
    const joined = sorted.filter((member) => timeOf(member.joinedAt) !== null).reverse();
    const notJoined = sorted.filter((member) => timeOf(member.joinedAt) === null);
    return [...joined, ...notJoined];
  }

  return sorted.reverse();
}

/* ---------------------------------------------------------------- summary */

export type MemberSummary = {
  total: number;
  active: number;
  invited: number;
  revoked: number;
  /** Seats consumed = active + invited, matching the backend rule. */
  seatsUsed: number;
};

export function summarizeMemberList(members: WorkspaceMember[]): MemberSummary {
  const active = members.filter((member) => member.status === "active").length;
  const invited = members.filter((member) => member.status === "invited").length;
  const revoked = members.filter((member) => member.status === "revoked").length;
  return { total: members.length, active, invited, revoked, seatsUsed: active + invited };
}

export function getPendingInvitations(members: WorkspaceMember[]): WorkspaceMember[] {
  return members
    .filter((member) => member.status === "invited")
    .sort((a, b) => (timeOf(b.createdAt) ?? 0) - (timeOf(a.createdAt) ?? 0));
}

/* --------------------------------------------------------------- timeline */

export type TimelineEvent = {
  id: string;
  icon: IconName;
  tone: "accent" | "info" | "warning" | "neutral";
  title: string;
  detail: string | null;
  timestamp: string;
  time: number;
};

/**
 * Lifecycle events reconstructed from the timestamps the API actually returns.
 *
 * BACKEND LIMITATION: there is no member event log, so only these moments are
 * representable. `updatedAt` is included only when it does not coincide with a
 * moment already shown, otherwise every row would end with a duplicate entry.
 */
export function buildMemberTimeline(member: WorkspaceMember, workspaceName: string | null): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  const push = (event: Omit<TimelineEvent, "time">) => {
    const time = timeOf(event.timestamp);
    if (time === null) return;
    events.push({ ...event, time });
  };

  const scope = workspaceName ? ` to ${workspaceName}` : "";

  push({
    id: "invited",
    icon: "mailClock",
    tone: "info",
    title: `Invitation sent${scope}`,
    detail: `Invited as ${member.role}`,
    timestamp: member.createdAt,
  });

  if (member.joinedAt) {
    push({
      id: "joined",
      icon: "check",
      tone: "accent",
      title: "Joined workspace",
      detail: member.userId ? "Invitation accepted — account linked" : "Seat activated",
      timestamp: member.joinedAt,
    });
  }

  if (member.revokedAt) {
    push({
      id: "revoked",
      icon: "ban",
      tone: "warning",
      title: "Access revoked",
      detail: "Seat released back to the workspace",
      timestamp: member.revokedAt,
    });
  }

  const updatedTime = timeOf(member.updatedAt);
  const alreadyShown = events.some((event) => Math.abs(event.time - (updatedTime ?? 0)) < 1000);
  if (updatedTime !== null && !alreadyShown) {
    push({
      id: "updated",
      icon: "refresh",
      tone: "neutral",
      title: "Membership updated",
      detail: `Now ${member.role} · ${member.status}`,
      timestamp: member.updatedAt,
    });
  }

  return events.sort((a, b) => b.time - a.time);
}

/** Whole days an invitation has been outstanding; null when not invited. */
export function getInvitationAgeDays(member: WorkspaceMember, now: number = Date.now()): number | null {
  if (member.status !== "invited") return null;
  const sent = timeOf(member.createdAt);
  if (sent === null) return null;
  return Math.max(0, Math.floor((now - sent) / 86_400_000));
}

/** Seat pressure context for the drawer; null when no workspace is loaded. */
export function getWorkspaceSeatContext(workspace: Workspace | null): { used: number; limit: number | null } | null {
  if (!workspace) return null;
  return { used: workspace.activeSeatCount, limit: workspace.seatLimit };
}
