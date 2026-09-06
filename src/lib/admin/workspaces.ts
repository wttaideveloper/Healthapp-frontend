import { isCalendarDate, isoToCalendarDate } from "@/lib/format";
import type { AdminUser, Workspace, WorkspaceMember } from "@/types/admin";

/**
 * Pure helpers for the Workspaces view.
 *
 * Everything runs client-side over the arrays already returned by
 * `GET /api/v1/admin/workspaces` and `GET /api/v1/admin/users`.
 * No backend search/filter/sort/pagination endpoint exists or is introduced.
 *
 * Backend vocabulary (`workspace.util.ts`):
 *   status              = "active" | "suspended" | "revoked"
 *   subscriptionStatus  = "active" | "trialing" | "past_due" | "expired" | "canceled"
 *                         (American spelling — NOT "cancelled")
 *
 * BACKEND: `workspaces.billing_source` ("manual" | "shopify") is returned as
 * `billingSource` on admin workspace payloads. Permanent delete is blocked for
 * Shopify-managed workspaces.
 */

export type WorkspaceStatusFilter = "all" | "active" | "suspended" | "revoked";
export type SubscriptionFilter = "all" | "active" | "trialing" | "past_due" | "expired" | "canceled";
export type SeatFilter = "all" | "available" | "full" | "over";
export type EntitlementFilter = "all" | "entitled" | "not-entitled";

export type WorkspaceSortKey = "name" | "owner" | "createdAt" | "expiresAt" | "seats";
export type SortDirection = "asc" | "desc";

export type WorkspaceFilterState = {
  search: string;
  status: WorkspaceStatusFilter;
  subscription: SubscriptionFilter;
  seats: SeatFilter;
  entitlement: EntitlementFilter;
};

export const defaultWorkspaceFilters: WorkspaceFilterState = {
  search: "",
  status: "all",
  subscription: "all",
  seats: "all",
  entitlement: "all",
};

export function countActiveWorkspaceFilters(filters: WorkspaceFilterState): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.status !== "all") count += 1;
  if (filters.subscription !== "all") count += 1;
  if (filters.seats !== "all") count += 1;
  if (filters.entitlement !== "all") count += 1;
  return count;
}

export type WorkspacePermanentDeleteCapabilities = {
  canPermanentlyDelete: boolean;
  blockedReason: string | null;
};

export function isShopifyManagedWorkspace(workspace: Pick<Workspace, "billingSource">): boolean {
  return (workspace.billingSource ?? "").trim().toLowerCase() === "shopify";
}

/**
 * UI hint only. The API re-checks Shopify links that this list payload may not include.
 */
export function getWorkspacePermanentDeleteCapabilities(
  workspace: Workspace,
): WorkspacePermanentDeleteCapabilities {
  if (isShopifyManagedWorkspace(workspace)) {
    return {
      canPermanentlyDelete: false,
      blockedReason: "Shopify-managed workspaces cannot be permanently deleted. Revoke the workspace instead.",
    };
  }
  return { canPermanentlyDelete: true, blockedReason: null };
}

/* ------------------------------------------------------------------ owner */

export type OwnerIndex = {
  byId: Map<string, AdminUser>;
  byEmail: Map<string, AdminUser>;
};

/** Built once per user list so owner resolution stays O(1) per row. */
export function buildOwnerIndex(users: AdminUser[]): OwnerIndex {
  const byId = new Map<string, AdminUser>();
  const byEmail = new Map<string, AdminUser>();
  for (const user of users) {
    byId.set(user.id, user);
    byEmail.set(user.email.trim().toLowerCase(), user);
  }
  return { byId, byEmail };
}

export type ResolvedOwner = {
  email: string;
  /** Null when no registered account matches — the invite is still pending. */
  name: string | null;
  user: AdminUser | null;
};

/**
 * `admin/workspaces` returns only `ownerUserId` and `ownerEmail`, so the
 * display name is cross-referenced from the already-loaded users list.
 */
export function resolveOwner(workspace: Workspace, index: OwnerIndex): ResolvedOwner {
  const email = workspace.ownerEmail.trim();
  const byId = workspace.ownerUserId ? index.byId.get(workspace.ownerUserId) : undefined;
  const user = byId ?? index.byEmail.get(email.toLowerCase()) ?? null;
  return { email, name: user?.name ?? null, user };
}

/* ------------------------------------------------------------------ seats */

export type SeatUsage = {
  used: number;
  limit: number | null;
  isUnlimited: boolean;
  /** 0-100, clamped for the bar; `isOverCapacity` carries the overflow signal. */
  percent: number;
  available: number;
  isFull: boolean;
  isOverCapacity: boolean;
};

/**
 * Structural subset needed to compute seat pressure. Widened from `Workspace` so
 * the Analytics dashboard can reuse the rule for `workspaces/me` rows, which
 * carry seat fields but not the full admin workspace record.
 */
export type SeatSubject = Pick<Workspace, "activeSeatCount" | "seatLimit">;

export function getSeatUsage(workspace: SeatSubject): SeatUsage {
  const used = Math.max(0, workspace.activeSeatCount);
  const limit = workspace.seatLimit;

  // Defensive: the API schema types seatLimit as a required number, but the
  // frontend type allows null and a future schema change could reintroduce it.
  if (limit === null || limit === undefined || limit <= 0) {
    return { used, limit: null, isUnlimited: true, percent: 0, available: Number.POSITIVE_INFINITY, isFull: false, isOverCapacity: false };
  }

  const percent = Math.min(100, Math.round((used / limit) * 100));
  return {
    used,
    limit,
    isUnlimited: false,
    percent,
    available: Math.max(0, limit - used),
    isFull: used >= limit,
    isOverCapacity: used > limit,
  };
}

/* ------------------------------------------------------------ entitlement */

/**
 * Mirrors the backend's `isWorkspaceAccessActive`. Kept in sync deliberately so
 * the console can explain *why* a workspace is or is not unlocking Pro access
 * without an extra request per row.
 */
export type EntitlementSubject = Pick<Workspace, "status" | "subscriptionStatus" | "expiresAt">;

export function isWorkspaceEntitled(workspace: EntitlementSubject, now: number = Date.now()): boolean {
  if (workspace.status !== "active") return false;
  if (workspace.subscriptionStatus !== "active" && workspace.subscriptionStatus !== "trialing") return false;
  if (!workspace.expiresAt) return true;
  const expiry = new Date(workspace.expiresAt).getTime();
  return Number.isFinite(expiry) ? expiry > now : true;
}

/** Human-readable reason a workspace is not entitled; null when it is. */
export function describeEntitlementBlock(workspace: EntitlementSubject, now: number = Date.now()): string | null {
  if (workspace.status !== "active") return `Workspace status is “${workspace.status}”`;
  if (workspace.subscriptionStatus !== "active" && workspace.subscriptionStatus !== "trialing") {
    return `Subscription is “${workspace.subscriptionStatus}”`;
  }
  if (workspace.expiresAt) {
    const expiry = new Date(workspace.expiresAt).getTime();
    if (Number.isFinite(expiry) && expiry <= now) return "Access period has expired";
  }
  return null;
}

/* --------------------------------------------------------------- filtering */

function matchesSearch(workspace: Workspace, owner: ResolvedOwner, needle: string): boolean {
  if (!needle) return true;
  if (workspace.name.toLowerCase().includes(needle)) return true;
  if (owner.email.toLowerCase().includes(needle)) return true;
  if (owner.name && owner.name.toLowerCase().includes(needle)) return true;
  return false;
}

function matchesSeatFilter(usage: SeatUsage, filter: SeatFilter): boolean {
  switch (filter) {
    case "available":
      return usage.isUnlimited || (!usage.isFull && usage.available > 0);
    case "full":
      // "Full" means exactly at capacity; overflow is its own bucket.
      return !usage.isUnlimited && usage.isFull && !usage.isOverCapacity;
    case "over":
      return usage.isOverCapacity;
    default:
      return true;
  }
}

export function filterWorkspaces(
  workspaces: Workspace[],
  filters: WorkspaceFilterState,
  index: OwnerIndex,
  now: number = Date.now(),
): Workspace[] {
  const needle = filters.search.trim().toLowerCase();

  if (
    !needle &&
    filters.status === "all" &&
    filters.subscription === "all" &&
    filters.seats === "all" &&
    filters.entitlement === "all"
  ) {
    return workspaces;
  }

  return workspaces.filter((workspace) => {
    if (filters.status !== "all" && workspace.status !== filters.status) return false;
    if (filters.subscription !== "all" && workspace.subscriptionStatus !== filters.subscription) return false;
    if (filters.seats !== "all" && !matchesSeatFilter(getSeatUsage(workspace), filters.seats)) return false;

    if (filters.entitlement !== "all") {
      const entitled = isWorkspaceEntitled(workspace, now);
      if (filters.entitlement === "entitled" && !entitled) return false;
      if (filters.entitlement === "not-entitled" && entitled) return false;
    }

    if (needle && !matchesSearch(workspace, resolveOwner(workspace, index), needle)) return false;
    return true;
  });
}

/* ----------------------------------------------------------------- sorting */

function timeOf(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Nulls (no expiry) sort last in both directions rather than as epoch 0. */
function compareNullableTime(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareWorkspaces(a: Workspace, b: Workspace, key: WorkspaceSortKey, index: OwnerIndex): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    case "owner": {
      const ownerA = resolveOwner(a, index);
      const ownerB = resolveOwner(b, index);
      const labelA = ownerA.name ?? ownerA.email;
      const labelB = ownerB.name ?? ownerB.email;
      return labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
    }
    case "createdAt":
      return (timeOf(a.createdAt) ?? 0) - (timeOf(b.createdAt) ?? 0);
    case "expiresAt":
      return compareNullableTime(timeOf(a.expiresAt), timeOf(b.expiresAt));
    case "seats": {
      const diff = a.activeSeatCount - b.activeSeatCount;
      return diff !== 0 ? diff : a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    }
    default:
      return 0;
  }
}

export function sortWorkspaces(
  workspaces: Workspace[],
  key: WorkspaceSortKey,
  direction: SortDirection,
  index: OwnerIndex,
): Workspace[] {
  const sorted = [...workspaces].sort((a, b) => compareWorkspaces(a, b, key, index));

  if (direction === "asc") return sorted;

  // Reversing would drag null expiries to the front; keep them pinned last.
  if (key === "expiresAt") {
    const withExpiry = sorted.filter((workspace) => timeOf(workspace.expiresAt) !== null).reverse();
    const withoutExpiry = sorted.filter((workspace) => timeOf(workspace.expiresAt) === null);
    return [...withExpiry, ...withoutExpiry];
  }

  return sorted.reverse();
}

/* ----------------------------------------------------------------- members */

export type MemberBreakdown = {
  total: number;
  active: number;
  invited: number;
  revoked: number;
  owners: WorkspaceMember[];
};

export function summarizeMembers(members: WorkspaceMember[]): MemberBreakdown {
  return {
    total: members.length,
    active: members.filter((member) => member.status === "active").length,
    invited: members.filter((member) => member.status === "invited").length,
    revoked: members.filter((member) => member.status === "revoked").length,
    owners: members.filter((member) => member.role === "owner"),
  };
}

/** Active members first, then invited, then revoked; owners lead each group. */
export function orderMembersForDisplay(members: WorkspaceMember[]): WorkspaceMember[] {
  const statusWeight: Record<string, number> = { active: 0, invited: 1, revoked: 2 };
  const roleWeight: Record<string, number> = { owner: 0, admin: 1, member: 2 };

  return [...members].sort((a, b) => {
    const statusDiff = (statusWeight[a.status] ?? 9) - (statusWeight[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    const roleDiff = (roleWeight[a.role] ?? 9) - (roleWeight[b.role] ?? 9);
    if (roleDiff !== 0) return roleDiff;
    return a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
  });
}

/* -------------------------------------------------------- form validation */

/**
 * Front-of-house wording for the rules the API already enforces.
 *
 * These checks mirror `createWorkspaceBodySchema` / `updateWorkspaceBodySchema`
 * one for one — they do not add, relax, or tighten anything. Their whole job is
 * to say "Please enter an organization name." before the request goes out,
 * instead of letting the admin read `body/name must NOT have fewer than 2
 * characters` back from the server.
 */
export type WorkspaceFormField = "name" | "ownerEmail" | "seatLimit" | "plan" | "expiresAt" | "notes";
export type WorkspaceFormErrors = Partial<Record<WorkspaceFormField, string>>;

export type WorkspaceCreateDraft = {
  name: string;
  ownerEmail: string;
  seatLimit: string;
  plan: string;
  /** Calendar date (`YYYY-MM-DD`), or "" when no expiry is set. */
  expiresAt: string;
  notes: string;
};

/** Update leaves out the fields the update form does not expose. */
export type WorkspaceUpdateDraft = Pick<WorkspaceCreateDraft, "seatLimit" | "plan" | "expiresAt" | "notes">;

/** The update form's fields, as strings, exactly as the inputs hold them. */
export type WorkspaceUpdateValues = {
  seatLimit: string;
  plan: string;
  subscriptionStatus: string;
  status: string;
  notes: string;
  /** Calendar date (`YYYY-MM-DD`), or "" when the workspace has no expiry. */
  expiresAt: string;
};

/**
 * A saved workspace rendered as update-form values.
 *
 * One definition, two callers: the page hydrates the form from it, and the
 * update dialog compares against it to decide whether there are unsaved
 * changes. If those two ever disagreed, the dialog would either nag about
 * edits nobody made or drop edits somebody did.
 */
export function workspaceUpdateValues(workspace: Workspace): WorkspaceUpdateValues {
  return {
    seatLimit: workspace.seatLimit === null ? "" : String(workspace.seatLimit),
    plan: workspace.plan,
    subscriptionStatus: workspace.subscriptionStatus,
    status: workspace.status,
    notes: workspace.notes ?? "",
    expiresAt: isoToCalendarDate(workspace.expiresAt),
  };
}

/** What the update form holds when no organization is selected. */
export const emptyWorkspaceUpdateValues: WorkspaceUpdateValues = {
  seatLimit: "",
  plan: "organization",
  subscriptionStatus: "active",
  status: "active",
  notes: "",
  expiresAt: "",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shared by both forms; `seatLimit` is required only when creating. */
function validateSeatLimit(value: string, required: boolean): string | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? "Please enter the number of licenses." : null;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1) return "Number of licenses must be at least 1.";
  return null;
}

function validateExpiry(value: string): string | null {
  // Expiry stays optional, exactly as the API has it — only a value that is
  // present and unusable is an error.
  if (!value.trim()) return null;
  return isCalendarDate(value) ? null : "Please select a subscription expiry date.";
}

function validateNotes(value: string): string | null {
  return value.trim().length > 1000 ? "Internal notes must be 1000 characters or fewer." : null;
}

function validatePlan(value: string): string | null {
  if (!value.trim()) return "Please enter a license type, for example “organization”.";
  return value.trim().length > 100 ? "License type must be 100 characters or fewer." : null;
}

export function validateWorkspaceCreateDraft(draft: WorkspaceCreateDraft): WorkspaceFormErrors {
  const errors: WorkspaceFormErrors = {};
  const name = draft.name.trim();
  const ownerEmail = draft.ownerEmail.trim();

  if (!name) errors.name = "Please enter an organization name.";
  else if (name.length < 2) errors.name = "Organization name must be at least 2 characters.";
  else if (name.length > 200) errors.name = "Organization name must be 200 characters or fewer.";

  if (!ownerEmail) errors.ownerEmail = "Please enter the administrator's email.";
  else if (!emailPattern.test(ownerEmail)) {
    errors.ownerEmail = "Please enter a valid email address, for example admin@abcclinic.com.";
  }

  const seatLimit = validateSeatLimit(draft.seatLimit, true);
  if (seatLimit) errors.seatLimit = seatLimit;

  const plan = validatePlan(draft.plan);
  if (plan) errors.plan = plan;

  const expiresAt = validateExpiry(draft.expiresAt);
  if (expiresAt) errors.expiresAt = expiresAt;

  const notes = validateNotes(draft.notes);
  if (notes) errors.notes = notes;

  return errors;
}

export function validateWorkspaceUpdateDraft(draft: WorkspaceUpdateDraft): WorkspaceFormErrors {
  const errors: WorkspaceFormErrors = {};

  // A blank seat limit still means "leave this as it is", which is how the
  // update endpoint has always read an omitted field.
  const seatLimit = validateSeatLimit(draft.seatLimit, false);
  if (seatLimit) errors.seatLimit = seatLimit;

  const plan = validatePlan(draft.plan);
  if (plan) errors.plan = plan;

  const expiresAt = validateExpiry(draft.expiresAt);
  if (expiresAt) errors.expiresAt = expiresAt;

  const notes = validateNotes(draft.notes);
  if (notes) errors.notes = notes;

  return errors;
}

