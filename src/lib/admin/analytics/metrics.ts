import type { AdminUser, Workspace, WorkspaceMember, WorkspaceMembership } from "@/types/admin";
import { getSeatUsage, isWorkspaceEntitled, type SeatUsage } from "@/lib/admin/workspaces";
import {
  buildBuckets,
  countBefore,
  countInBuckets,
  countWithin,
  cumulativeFrom,
  isWithin,
  previousWindow,
  toTime,
  type Bucket,
  type DateRange,
  DAY_MS,
} from "@/lib/admin/analytics/range";

/**
 * Analytics calculations for the executive dashboard.
 *
 * ============================ SOURCE OF TRUTH =============================
 * There is NO analytics endpoint on the API. Every number below is derived
 * client-side from records the existing endpoints already return:
 *
 *   GET admin/workspaces          -> full workspace rows incl. createdAt,
 *                                    status, subscriptionStatus, seatLimit,
 *                                    activeSeatCount, expiresAt, revokedAt
 *   GET admin/users               -> full user rows incl. createdAt, role,
 *                                    status, hasAccess, isEmailVerified
 *   GET admin/workspaces/:id      -> members for ONE workspace
 *   GET workspaces/me             -> workspace summaries for a workspace admin
 *                                    (NO createdAt / updatedAt — see below)
 *   GET workspaces/:id/members    -> members for ONE workspace
 *
 * Nothing is estimated, extrapolated, or filled in with sample data. When a
 * figure cannot be derived from the above it is returned as `unavailable` with
 * the reason, and the UI renders an explanation instead of a number.
 *
 * ========================= KNOWN BACKEND LIMITS ===========================
 * 1. No platform-wide member endpoint. Member-level figures (pending
 *    invitations, roles, revocations, joins) cover only the workspaces whose
 *    member lists have actually been fetched — see `MemberCoverage`.
 * 2. `workspaces/me` omits createdAt/updatedAt, so workspace-growth history is
 *    unavailable to workspace admins (platform admins have it).
 * 3. No audit log. Only create / join / revoke moments are representable; edits
 *    and deletions leave no trace.
 * 4. `seatLimit` has no "unlimited" representation in the admin schema, but the
 *    frontend type allows null; unlimited workspaces are excluded from
 *    "seats available" rather than counted as infinity.
 */

/* ------------------------------------------------------------------ values */

export type Analytic = {
  state: "ready" | "unavailable";
  value: number;
  /** Short clarifier shown under a ready value. */
  hint?: string;
  /** Why the figure could not be derived. Present only when unavailable. */
  reason?: string;
};

export function ready(value: number, hint?: string): Analytic {
  return { state: "ready", value, hint };
}

export function unavailable(reason: string): Analytic {
  return { state: "unavailable", value: 0, reason };
}

/* ------------------------------------------------------------- normalising */

/**
 * The common shape both workspace sources reduce to.
 *
 * `createdAt` is nullable on purpose: `workspaces/me` does not return it, and
 * inventing a date there would fabricate history.
 */
export type WorkspaceRow = {
  id: string;
  name: string;
  status: string;
  subscriptionStatus: string;
  plan: string;
  seatLimit: number | null;
  activeSeatCount: number;
  expiresAt: string | null;
  createdAt: string | null;
  ownerEmail: string | null;
  role: string | null;
};

export function toWorkspaceRows(workspaces: Workspace[]): WorkspaceRow[] {
  return workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    status: workspace.status,
    subscriptionStatus: workspace.subscriptionStatus,
    plan: workspace.plan,
    seatLimit: workspace.seatLimit,
    activeSeatCount: workspace.activeSeatCount,
    expiresAt: workspace.expiresAt,
    createdAt: workspace.createdAt,
    ownerEmail: workspace.ownerEmail,
    role: null,
  }));
}

export function toMembershipRows(memberships: WorkspaceMembership[]): WorkspaceRow[] {
  return memberships.map((membership) => ({
    id: membership.id,
    name: membership.name,
    status: membership.status,
    subscriptionStatus: membership.subscriptionStatus,
    plan: membership.plan,
    seatLimit: membership.seatLimit,
    activeSeatCount: membership.activeSeatCount,
    expiresAt: membership.expiresAt,
    // BACKEND LIMITATION: `workspaceSummarySchema` returns no timestamps.
    createdAt: null,
    ownerEmail: null,
    role: membership.role,
  }));
}

/* -------------------------------------------------------------- coverage */

/**
 * How much of the member population the loaded data actually represents.
 *
 * `scoped`  – only the currently selected workspace's members are loaded (the
 *             default, because that is all the console fetches).
 * `full`    – every workspace's member list has been fetched by fanning out over
 *             the existing per-workspace endpoints.
 */
export type MemberCoverage = {
  mode: "none" | "scoped" | "full";
  /** Workspace name when scoped, else null. */
  scopeLabel: string | null;
  workspacesCovered: number;
  workspacesTotal: number;
  /** Workspaces whose member fetch failed during a full scan. */
  failedCount: number;
};

export const MEMBER_COVERAGE_NOTE =
  "The API has no platform-wide member endpoint. Member figures are computed by reading each workspace's member list through the existing per-workspace endpoint.";

export function scopedCoverage(scopeLabel: string | null, workspacesTotal: number): MemberCoverage {
  return {
    mode: scopeLabel ? "scoped" : "none",
    scopeLabel,
    workspacesCovered: scopeLabel ? 1 : 0,
    workspacesTotal,
    failedCount: 0,
  };
}

function memberScopeReason(coverage: MemberCoverage): string {
  if (coverage.mode === "none") {
    return "No workspace member list is loaded. Select a workspace, or run a full member scan.";
  }
  return `Only “${coverage.scopeLabel}” is loaded. Run a full member scan to cover all ${coverage.workspacesTotal} workspaces.`;
}

/* ----------------------------------------------------------------- input */

export type AnalyticsInput = {
  isPlatformAdmin: boolean;
  rows: WorkspaceRow[];
  users: AdminUser[];
  /** Scoped to `coverage` — never assume this is the whole platform. */
  members: WorkspaceMember[];
  coverage: MemberCoverage;
  range: DateRange;
  now: number;
};

const ENTITLED_SUBSCRIPTIONS = new Set(["active", "trialing"]);

/* ------------------------------------------------------------------- KPIs */

export type KpiKey =
  | "totalUsers"
  | "activeUsers"
  | "totalWorkspaces"
  | "activeWorkspaces"
  | "totalMembers"
  | "pendingInvitations"
  | "seatsUsed"
  | "seatsAvailable"
  | "activeSubscriptions"
  | "lockedWorkspaces";

export type KpiSet = Record<KpiKey, Analytic>;

export function computeKpis(input: AnalyticsInput): KpiSet {
  const { rows, users, members, coverage, isPlatformAdmin, now } = input;

  const usages = rows.map((row) => getSeatUsage(row));
  const seatsUsed = usages.reduce((sum, usage) => sum + usage.used, 0);
  const limited = usages.filter((usage) => !usage.isUnlimited);
  const seatsAvailable = limited.reduce((sum, usage) => sum + usage.available, 0);
  const atCapacity = limited.filter((usage) => usage.isFull).length;
  const unlimitedCount = usages.length - limited.length;

  const activeSubscriptions = rows.filter((row) => ENTITLED_SUBSCRIPTIONS.has(row.subscriptionStatus)).length;
  const locked = rows.filter((row) => !isWorkspaceEntitled(row, now));

  const usersWithAccess = users.filter((user) => user.hasAccess).length;
  const activeUsers = users.filter((user) => user.status === "active").length;

  const fullMembers = coverage.mode === "full";

  return {
    totalUsers: isPlatformAdmin
      ? ready(users.length, `${usersWithAccess.toLocaleString()} currently entitled`)
      : unavailable("GET admin/users is restricted to platform admins."),

    activeUsers: isPlatformAdmin
      ? ready(
          activeUsers,
          users.length > 0
            ? `${Math.round((activeUsers / users.length) * 100)}% of accounts activated`
            : undefined,
        )
      : unavailable("GET admin/users is restricted to platform admins."),

    totalWorkspaces: ready(
      rows.length,
      isPlatformAdmin ? "Across the platform" : "Workspaces you administer",
    ),

    activeWorkspaces: ready(
      rows.filter((row) => row.status === "active").length,
      `of ${rows.length.toLocaleString()} total`,
    ),

    totalMembers: fullMembers
      ? ready(members.length, `Across ${coverage.workspacesCovered.toLocaleString()} workspaces`)
      : ready(seatsUsed, "Seat-holding members · revoked seats excluded"),

    pendingInvitations:
      coverage.mode === "full"
        ? ready(
            members.filter((member) => member.status === "invited").length,
            `Across ${coverage.workspacesCovered.toLocaleString()} workspaces`,
          )
        : coverage.mode === "scoped"
          ? ready(
              members.filter((member) => member.status === "invited").length,
              `In “${coverage.scopeLabel}” only`,
            )
          : unavailable(memberScopeReason(coverage)),

    seatsUsed: ready(
      seatsUsed,
      unlimitedCount > 0
        ? `${unlimitedCount} workspace${unlimitedCount === 1 ? "" : "s"} with no seat cap`
        : `${atCapacity} workspace${atCapacity === 1 ? "" : "s"} at capacity`,
    ),

    seatsAvailable:
      limited.length > 0
        ? ready(seatsAvailable, `Across ${limited.length.toLocaleString()} capped workspaces`)
        : unavailable("No workspace defines a seat limit, so free capacity is undefined."),

    activeSubscriptions: ready(activeSubscriptions, "Status active or trialing"),

    lockedWorkspaces: ready(
      locked.length,
      locked.length > 0 ? "Pro access is not unlocking" : "All workspaces unlocking Pro",
    ),
  };
}

export const kpiMeta: Record<KpiKey, { label: string; description: string }> = {
  totalUsers: { label: "Total Users", description: "Registered accounts on the platform." },
  activeUsers: { label: "Active Users", description: "Accounts with status “active” (approved and able to sign in)." },
  totalWorkspaces: { label: "Total Workspaces", description: "Organization workspaces provisioned." },
  activeWorkspaces: { label: "Active Workspaces", description: "Workspaces whose status is “active”." },
  totalMembers: { label: "Total Members", description: "Workspace seats held across the platform." },
  pendingInvitations: { label: "Pending Invitations", description: "Members invited but not yet signed up." },
  seatsUsed: { label: "Seats Used", description: "Non-revoked members occupying a seat." },
  seatsAvailable: { label: "Seats Available", description: "Remaining capacity across workspaces with a seat limit." },
  activeSubscriptions: { label: "Active Subscriptions", description: "Workspaces billing as active or trialing." },
  lockedWorkspaces: { label: "Locked Workspaces", description: "Workspaces not currently unlocking Pro access." },
};

/* ---------------------------------------------------------------- health */

export type HealthTone = "good" | "warning" | "critical" | "neutral";

export type HealthRow = {
  key: string;
  label: string;
  description: string;
  tone: HealthTone;
  metric: Analytic;
  /** Names behind the number, for the expandable detail list. */
  samples: string[];
};

/** Seat pressure at or above this share counts as "near capacity". */
export const NEAR_CAPACITY_THRESHOLD = 0.9;
export const STALE_INVITE_DAYS = 7;
export const EXPIRING_SOON_DAYS = 14;

function isNearCapacity(usage: SeatUsage): boolean {
  if (usage.isUnlimited) return false;
  if (usage.isFull || usage.isOverCapacity) return true;
  return usage.percent >= NEAR_CAPACITY_THRESHOLD * 100;
}

function isExpired(row: WorkspaceRow, now: number): boolean {
  if (row.subscriptionStatus === "expired" || row.subscriptionStatus === "canceled") return true;
  const expiry = toTime(row.expiresAt);
  return expiry !== null && expiry <= now;
}

export function computeHealth(input: AnalyticsInput): HealthRow[] {
  const { rows, members, coverage, now } = input;

  const nearCapacity = rows.filter((row) => isNearCapacity(getSeatUsage(row)));
  const expired = rows.filter((row) => isExpired(row, now));
  const expiringSoon = rows.filter((row) => {
    const expiry = toTime(row.expiresAt);
    if (expiry === null || expiry <= now) return false;
    return expiry - now <= EXPIRING_SOON_DAYS * DAY_MS;
  });
  const pastDue = rows.filter((row) => row.subscriptionStatus === "past_due");

  const healthy = rows.filter(
    (row) =>
      isWorkspaceEntitled(row, now) &&
      !isNearCapacity(getSeatUsage(row)) &&
      !expiringSoon.some((candidate) => candidate.id === row.id),
  );

  const memberScoped = coverage.mode === "none";
  const staleInvites = members.filter((member) => {
    if (member.status !== "invited") return false;
    const sent = toTime(member.createdAt);
    return sent !== null && now - sent > STALE_INVITE_DAYS * DAY_MS;
  });
  const revoked = members.filter((member) => member.status === "revoked");

  const memberHint =
    coverage.mode === "full"
      ? `Across ${coverage.workspacesCovered.toLocaleString()} workspaces`
      : `In “${coverage.scopeLabel}” only`;

  return [
    {
      key: "healthy",
      label: "Healthy Workspaces",
      description: "Entitled, under 90% seat usage, and not expiring within 14 days.",
      tone: "good",
      metric: ready(healthy.length, `of ${rows.length.toLocaleString()} workspaces`),
      samples: healthy.map((row) => row.name),
    },
    {
      key: "near-capacity",
      label: "Near Capacity",
      description: "Seat usage at or above 90% of the workspace limit.",
      tone: nearCapacity.length > 0 ? "warning" : "neutral",
      metric: ready(nearCapacity.length, nearCapacity.length > 0 ? "Consider raising seat limits" : "No seat pressure"),
      samples: nearCapacity.map((row) => `${row.name} · ${row.activeSeatCount}/${row.seatLimit ?? "∞"}`),
    },
    {
      key: "expired",
      label: "Expired Workspaces",
      description: "Access period elapsed, or subscription expired/canceled.",
      tone: expired.length > 0 ? "critical" : "neutral",
      metric: ready(expired.length, expired.length > 0 ? "Pro access is blocked" : "None expired"),
      samples: expired.map((row) => `${row.name} · ${row.subscriptionStatus}`),
    },
    {
      key: "expiring-soon",
      label: "Expiring Within 14 Days",
      description: "Access period ends soon — renewal is handled outside the app.",
      tone: expiringSoon.length > 0 ? "warning" : "neutral",
      metric: ready(expiringSoon.length, expiringSoon.length > 0 ? "Renewal needed" : "Nothing lapsing soon"),
      samples: expiringSoon.map((row) => `${row.name} · ${new Date(toTime(row.expiresAt)!).toLocaleDateString()}`),
    },
    {
      key: "past-due",
      label: "Past Due Subscriptions",
      description: "Billing status is past_due but access has not yet been revoked.",
      tone: pastDue.length > 0 ? "warning" : "neutral",
      metric: ready(pastDue.length, pastDue.length > 0 ? "Payment attention needed" : "No payment issues"),
      samples: pastDue.map((row) => row.name),
    },
    {
      key: "stale-invites",
      label: `Invitations Pending > ${STALE_INVITE_DAYS} Days`,
      description: "Invited members who have still not created an account.",
      tone: staleInvites.length > 0 ? "warning" : "neutral",
      metric: memberScoped
        ? unavailable(memberScopeReason(coverage))
        : ready(staleInvites.length, memberHint),
      samples: staleInvites.map((member) => member.email),
    },
    {
      key: "revoked-members",
      label: "Revoked Members",
      description: "Seats released by revocation; the record is retained.",
      tone: revoked.length > 0 ? "neutral" : "neutral",
      metric: memberScoped ? unavailable(memberScopeReason(coverage)) : ready(revoked.length, memberHint),
      samples: revoked.map((member) => `${member.email} · ${member.role}`),
    },
  ];
}

/* ---------------------------------------------------------------- growth */

export type GrowthSeries = {
  key: string;
  label: string;
  /** Records created inside the selected range. */
  created: Analytic;
  /** Same-length window immediately before the range; null when not comparable. */
  previous: number | null;
  /** Percent change vs the previous window; null when undefined (prior = 0). */
  changePercent: number | null;
  buckets: Bucket[];
  /** New records per bucket. */
  newPerBucket: number[];
  /** Running total per bucket, seeded with records that predate the range. */
  cumulative: number[];
  /** Why the series has no data — rendered as an empty state. */
  reason: string | null;
};

function buildSeries(
  key: string,
  label: string,
  times: number[],
  hasTimestamps: boolean,
  missingReason: string,
  input: AnalyticsInput,
): GrowthSeries {
  const { range, now } = input;

  if (!hasTimestamps) {
    return {
      key,
      label,
      created: unavailable(missingReason),
      previous: null,
      changePercent: null,
      buckets: [],
      newPerBucket: [],
      cumulative: [],
      reason: missingReason,
    };
  }

  const earliest = times.length > 0 ? Math.min(...times) : null;
  const buckets = buildBuckets(range, now, earliest);
  const newPerBucket = countInBuckets(times, buckets);
  const baseline = buckets.length > 0 ? countBefore(times, buckets[0].start) : 0;
  const created = countWithin(times, range.since, range.until);

  const window = previousWindow(range);
  const previous = window ? countWithin(times, window.since, window.until) : null;
  const changePercent =
    previous === null || previous === 0 ? null : Math.round(((created - previous) / previous) * 100);

  return {
    key,
    label,
    created: ready(created),
    previous,
    changePercent,
    buckets,
    newPerBucket,
    cumulative: cumulativeFrom(baseline, newPerBucket),
    reason: times.length === 0 ? "No records carry a timestamp in this range yet." : null,
  };
}

export function computeGrowth(input: AnalyticsInput): GrowthSeries[] {
  const { rows, users, members, coverage, isPlatformAdmin } = input;

  const userTimes = users.map((user) => toTime(user.createdAt)).filter((time): time is number => time !== null);
  const workspaceTimes = rows
    .map((row) => toTime(row.createdAt))
    .filter((time): time is number => time !== null);
  const memberTimes = members
    .map((member) => toTime(member.createdAt))
    .filter((time): time is number => time !== null);

  return [
    buildSeries(
      "users",
      "Users created",
      userTimes,
      isPlatformAdmin,
      "GET admin/users is restricted to platform admins, so user growth cannot be derived here.",
      input,
    ),
    buildSeries(
      "workspaces",
      "Workspaces created",
      workspaceTimes,
      rows.length === 0 || rows.some((row) => row.createdAt !== null),
      "GET workspaces/me returns no createdAt timestamp, so workspace growth cannot be derived here.",
      input,
    ),
    buildSeries(
      "invitations",
      "Members invited",
      memberTimes,
      coverage.mode !== "none",
      memberScopeReason(coverage),
      input,
    ),
  ];
}

/* --------------------------------------------------------- distributions */

export type DistributionSlice = {
  key: string;
  label: string;
  value: number;
  /** Semantic role so the chart can colour status data with status tokens. */
  tone: "good" | "info" | "warning" | "critical" | "neutral" | null;
  /**
   * Position in the canonical category order — NOT the position in the rendered
   * array. Colour must follow the entity, so a category that happens to be empty
   * (and therefore omitted) never repaints the categories after it.
   */
  colorIndex: number;
};

export type Distribution = {
  key: string;
  title: string;
  description: string;
  slices: DistributionSlice[];
  total: number;
  /** Null when the distribution is renderable. */
  reason: string | null;
  /** True when slices carry status meaning and must wear status tokens. */
  isStatus: boolean;
};

const workspaceStatusTone: Record<string, DistributionSlice["tone"]> = {
  active: "good",
  suspended: "warning",
  revoked: "critical",
};

const subscriptionTone: Record<string, DistributionSlice["tone"]> = {
  active: "good",
  trialing: "info",
  past_due: "warning",
  expired: "critical",
  canceled: "neutral",
};

const memberStatusTone: Record<string, DistributionSlice["tone"]> = {
  active: "good",
  invited: "warning",
  revoked: "critical",
};

function tally<T>(items: T[], keyOf: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function toSlices(
  counts: Map<string, number>,
  toneMap: Record<string, DistributionSlice["tone"]> | null,
  order: string[],
): DistributionSlice[] {
  const seen = new Set<string>();
  const slices: DistributionSlice[] = [];

  order.forEach((key, index) => {
    const value = counts.get(key);
    seen.add(key);
    if (value === undefined || value === 0) return;
    slices.push({
      key,
      label: key.replace(/_/g, " "),
      value,
      tone: toneMap?.[key] ?? null,
      colorIndex: index,
    });
  });

  // Unknown backend values stay visible rather than being silently dropped.
  let extra = order.length;
  for (const [key, value] of counts) {
    if (seen.has(key) || value === 0) continue;
    slices.push({
      key,
      label: key.replace(/_/g, " "),
      value,
      tone: toneMap?.[key] ?? "neutral",
      colorIndex: extra,
    });
    extra += 1;
  }

  return slices;
}

export function computeDistributions(input: AnalyticsInput): Distribution[] {
  const { rows, users, members, coverage } = input;

  const workspaceStatus = toSlices(
    tally(rows, (row) => row.status),
    workspaceStatusTone,
    ["active", "suspended", "revoked"],
  );

  const subscription = toSlices(
    tally(rows, (row) => row.subscriptionStatus),
    subscriptionTone,
    ["active", "trialing", "past_due", "expired", "canceled"],
  );

  const roleCounts = tally(members, (member) => member.role);
  const role = toSlices(roleCounts, null, ["owner", "admin", "member"]);

  const memberStatus = toSlices(
    tally(members, (member) => member.status),
    memberStatusTone,
    ["active", "invited", "revoked"],
  );

  const accountRole = toSlices(
    tally(users, (user) => user.role),
    null,
    ["admin", "user"],
  );

  const memberReason = coverage.mode === "none" ? memberScopeReason(coverage) : null;
  const memberScopeNote =
    coverage.mode === "full"
      ? `All ${coverage.workspacesCovered.toLocaleString()} workspaces.`
      : `Scoped to “${coverage.scopeLabel}”.`;

  const distributions: Distribution[] = [
    {
      key: "workspace-status",
      title: "Workspace Status",
      description: "Lifecycle state of every provisioned workspace.",
      slices: workspaceStatus,
      total: rows.length,
      reason: rows.length === 0 ? "No workspaces have been provisioned yet." : null,
      isStatus: true,
    },
    {
      key: "subscription-status",
      title: "Subscription Status",
      description: "Billing state as recorded on the workspace.",
      slices: subscription,
      total: rows.length,
      reason: rows.length === 0 ? "No workspaces have been provisioned yet." : null,
      isStatus: true,
    },
    {
      key: "member-role",
      title: "Role Distribution",
      description: `Seat roles within workspace membership. ${memberReason ? "" : memberScopeNote}`.trim(),
      slices: role,
      total: members.length,
      reason: memberReason ?? (members.length === 0 ? "No member records are loaded." : null),
      isStatus: false,
    },
    {
      key: "member-status",
      title: "Member Status",
      description: `Invitation and revocation state. ${memberReason ? "" : memberScopeNote}`.trim(),
      slices: memberStatus,
      total: members.length,
      reason: memberReason ?? (members.length === 0 ? "No member records are loaded." : null),
      isStatus: true,
    },
  ];

  if (input.isPlatformAdmin) {
    distributions.push({
      key: "account-role",
      title: "Account Role",
      description: "Platform administrators versus standard accounts.",
      slices: accountRole,
      total: users.length,
      reason: users.length === 0 ? "No user accounts are loaded." : null,
      isStatus: false,
    });
  }

  return distributions;
}

/* ------------------------------------------------------------ top lists */

export type RankedEntry = {
  key: string;
  label: string;
  sublabel: string | null;
  value: number;
  /** Formatted value shown at the row end. */
  display: string;
  /** 0-1 share of the largest value, for the inline bar. */
  share: number;
  tone: "good" | "warning" | "critical" | null;
};

export type RankedList = {
  key: string;
  title: string;
  description: string;
  entries: RankedEntry[];
  reason: string | null;
};

function withShare(entries: Omit<RankedEntry, "share">[]): RankedEntry[] {
  const max = entries.reduce((best, entry) => Math.max(best, entry.value), 0);
  return entries.map((entry) => ({ ...entry, share: max > 0 ? entry.value / max : 0 }));
}

export function computeTopLists(input: AnalyticsInput, limit = 6): RankedList[] {
  const { rows, members, coverage, range, now } = input;

  const bySeats = [...rows]
    .filter((row) => row.activeSeatCount > 0)
    .sort((a, b) => b.activeSeatCount - a.activeSeatCount)
    .slice(0, limit);

  const byUtilization = rows
    .map((row) => ({ row, usage: getSeatUsage(row) }))
    .filter((item) => !item.usage.isUnlimited && item.usage.limit !== null && item.usage.used > 0)
    .sort((a, b) => b.usage.percent - a.usage.percent)
    .slice(0, limit);

  const createdRows = rows
    .map((row) => ({ row, time: toTime(row.createdAt) }))
    .filter((item): item is { row: WorkspaceRow; time: number } => item.time !== null)
    .filter((item) => isWithin(item.time, range.since, range.until))
    .sort((a, b) => b.time - a.time)
    .slice(0, limit);

  const joined = members
    .map((member) => ({ member, time: toTime(member.joinedAt) }))
    .filter((item): item is { member: WorkspaceMember; time: number } => item.time !== null)
    .filter((item) => isWithin(item.time, range.since, range.until))
    .sort((a, b) => b.time - a.time)
    .slice(0, limit);

  const memberReason = coverage.mode === "none" ? memberScopeReason(coverage) : null;

  return [
    {
      key: "most-members",
      title: "Most Members",
      description: "Workspaces ranked by seats currently occupied.",
      reason: bySeats.length === 0 ? "No workspace has an occupied seat yet." : null,
      entries: withShare(
        bySeats.map((row) => ({
          key: row.id,
          label: row.name,
          sublabel: row.seatLimit ? `${row.activeSeatCount} of ${row.seatLimit} seats` : "No seat cap",
          value: row.activeSeatCount,
          display: row.activeSeatCount.toLocaleString(),
          tone: null,
        })),
      ),
    },
    {
      key: "highest-utilization",
      title: "Highest Seat Usage",
      description: "Workspaces closest to their seat limit.",
      reason:
        byUtilization.length === 0 ? "No workspace with a seat limit has occupied seats yet." : null,
      entries: withShare(
        byUtilization.map(({ row, usage }) => ({
          key: row.id,
          label: row.name,
          sublabel: `${usage.used} of ${usage.limit} seats`,
          value: usage.percent,
          display: `${usage.percent}%`,
          tone: usage.isFull || usage.isOverCapacity ? "critical" : usage.percent >= 75 ? "warning" : "good",
        })),
      ),
    },
    {
      key: "largest-capacity",
      title: "Largest Workspaces",
      description: "Workspaces ranked by provisioned seat capacity.",
      reason: rows.every((row) => !row.seatLimit) ? "No workspace defines a seat limit." : null,
      entries: withShare(
        [...rows]
          .filter((row) => row.seatLimit !== null && row.seatLimit > 0)
          .sort((a, b) => (b.seatLimit ?? 0) - (a.seatLimit ?? 0))
          .slice(0, limit)
          .map((row) => ({
            key: row.id,
            label: row.name,
            sublabel: `${row.plan} plan`,
            value: row.seatLimit ?? 0,
            display: `${(row.seatLimit ?? 0).toLocaleString()} seats`,
            tone: null,
          })),
      ),
    },
    {
      key: "recent-workspaces",
      title: "Recently Created Workspaces",
      description: `Provisioned during ${range.label.toLowerCase()}.`,
      reason:
        rows.length > 0 && rows.every((row) => row.createdAt === null)
          ? "GET workspaces/me returns no createdAt timestamp."
          : createdRows.length === 0
            ? `No workspace was created in ${range.label.toLowerCase()}.`
            : null,
      entries: withShare(
        createdRows.map(({ row, time }) => ({
          key: row.id,
          label: row.name,
          sublabel: row.ownerEmail,
          value: time,
          display: formatDayCount(now - time),
          tone: null,
        })),
      ),
    },
    {
      key: "recent-members",
      title: "Recently Joined Members",
      description: `Seats activated during ${range.label.toLowerCase()}.`,
      reason:
        memberReason ??
        (joined.length === 0 ? `No member joined in ${range.label.toLowerCase()}.` : null),
      entries: withShare(
        joined.map(({ member, time }) => ({
          key: member.id,
          label: member.email,
          sublabel: member.role,
          value: time,
          display: formatDayCount(now - time),
          tone: null,
        })),
      ),
    },
  ];
}

function formatDayCount(elapsed: number): string {
  const days = Math.floor(elapsed / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ------------------------------------------------------- quick insights */

export type QuickInsight = {
  key: string;
  tone: HealthTone;
  message: string;
  /** How the statement was derived, so nothing reads as an unexplained claim. */
  basis: string;
};

/** "is" for one, "are" for any other count — these strings are read by people. */
function verb(count: number): string {
  return count === 1 ? "is" : "are";
}

/**
 * Plain-language statements, every one of which is a direct restatement of a
 * computed figure. Nothing is generated when the underlying figure is
 * unavailable — silence is preferred over a guess.
 */
export function computeQuickInsights(
  input: AnalyticsInput,
  kpis: KpiSet,
  health: HealthRow[],
  growth: GrowthSeries[],
): QuickInsight[] {
  const insights: QuickInsight[] = [];
  const { rows, coverage, range } = input;
  const byKey = new Map(health.map((row) => [row.key, row]));

  const healthy = byKey.get("healthy");
  if (rows.length > 0 && healthy?.metric.state === "ready") {
    const share = Math.round((healthy.metric.value / rows.length) * 100);
    insights.push({
      key: "healthy-share",
      tone: share >= 80 ? "good" : share >= 50 ? "warning" : "critical",
      message:
        share === 100
          ? rows.length === 1
            ? "The only workspace is healthy."
            : `All ${rows.length} workspaces are healthy.`
          : `${healthy.metric.value} of ${rows.length} workspaces ${verb(healthy.metric.value)} healthy (${share}%).`,
      basis: "Entitled, under 90% seat usage, not expiring within 14 days.",
    });
  }

  const near = byKey.get("near-capacity");
  if (near?.metric.state === "ready" && near.metric.value > 0) {
    insights.push({
      key: "near-capacity",
      tone: "warning",
      message: `${near.metric.value} workspace${near.metric.value === 1 ? " is" : "s are"} at or above 90% seat usage.`,
      basis: "activeSeatCount vs seatLimit on the workspace record.",
    });
  }

  const expired = byKey.get("expired");
  if (expired?.metric.state === "ready") {
    insights.push({
      key: "expired",
      tone: expired.metric.value > 0 ? "critical" : "good",
      message:
        expired.metric.value === 0
          ? "No expired subscriptions."
          : `${expired.metric.value} workspace${expired.metric.value === 1 ? " has" : "s have"} an expired or canceled subscription.`,
      basis: "subscriptionStatus and expiresAt on the workspace record.",
    });
  }

  if (kpis.pendingInvitations.state === "ready") {
    const value = kpis.pendingInvitations.value;
    const scope = coverage.mode === "full" ? "" : ` in “${coverage.scopeLabel}”`;
    insights.push({
      key: "pending-invitations",
      tone: value > 0 ? "warning" : "good",
      message:
        value === 0
          ? `No invitations are pending${scope}.`
          : `${value} invitation${value === 1 ? " is" : "s are"} pending${scope}.`,
      basis: "Members with status “invited”.",
    });
  }

  const stale = byKey.get("stale-invites");
  if (stale?.metric.state === "ready" && stale.metric.value > 0) {
    insights.push({
      key: "stale-invites",
      tone: "warning",
      message: `${stale.metric.value} invitation${stale.metric.value === 1 ? " has" : "s have"} been pending for more than ${STALE_INVITE_DAYS} days.`,
      basis: "Member createdAt for rows still in status “invited”.",
    });
  }

  if (kpis.seatsAvailable.state === "ready" && kpis.seatsUsed.state === "ready") {
    const total = kpis.seatsAvailable.value + kpis.seatsUsed.value;
    if (total > 0) {
      const utilisation = Math.round((kpis.seatsUsed.value / total) * 100);
      insights.push({
        key: "seat-utilisation",
        tone: utilisation >= 90 ? "critical" : utilisation >= 75 ? "warning" : "good",
        message: `${utilisation}% of provisioned seats are in use (${kpis.seatsUsed.value.toLocaleString()} of ${total.toLocaleString()}).`,
        basis: "Sum of activeSeatCount over sum of seatLimit.",
      });
    }
  }

  const locked = kpis.lockedWorkspaces;
  if (locked.state === "ready" && locked.value > 0) {
    insights.push({
      key: "locked",
      tone: "critical",
      message: `${locked.value} workspace${locked.value === 1 ? " is" : "s are"} not unlocking Pro access for members.`,
      basis: "Mirrors the backend isWorkspaceAccessActive rule.",
    });
  }

  const expiringSoon = byKey.get("expiring-soon");
  if (expiringSoon?.metric.state === "ready" && expiringSoon.metric.value > 0) {
    insights.push({
      key: "expiring-soon",
      tone: "warning",
      message: `${expiringSoon.metric.value} workspace${expiringSoon.metric.value === 1 ? "" : "s"} expire${expiringSoon.metric.value === 1 ? "s" : ""} within ${EXPIRING_SOON_DAYS} days.`,
      basis: "expiresAt on the workspace record.",
    });
  }

  if (range.key !== "all") {
    // Reuses the already-computed series rather than recalculating it.
    const series = growth.find((entry) => entry.key === "workspaces");
    if (series && series.created.state === "ready" && series.previous !== null) {
      const delta = series.created.value - series.previous;
      if (delta !== 0) {
        const comparison =
          series.previous === 0
            ? "up from none in the period before"
            : `${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} than the ${series.previous} in the period before`;
        insights.push({
          key: "workspace-trend",
          tone: delta > 0 ? "good" : "neutral",
          message: `${series.created.value} workspace${series.created.value === 1 ? "" : "s"} created in ${range.label.toLowerCase()} — ${comparison}.`,
          basis: "Workspace createdAt compared against the preceding window.",
        });
      }
    }
  }

  return insights;
}

/* ------------------------------------------------------- seat utilisation */

export type SeatUtilizationRow = {
  id: string;
  name: string;
  used: number;
  limit: number | null;
  percent: number;
  tone: "good" | "warning" | "critical";
};

export function computeSeatUtilization(input: AnalyticsInput, limit = 10): SeatUtilizationRow[] {
  return input.rows
    .map((row) => ({ row, usage: getSeatUsage(row) }))
    .filter((item) => !item.usage.isUnlimited && item.usage.limit !== null)
    .sort((a, b) => b.usage.percent - a.usage.percent || b.usage.used - a.usage.used)
    .slice(0, limit)
    .map(({ row, usage }) => ({
      id: row.id,
      name: row.name,
      used: usage.used,
      limit: usage.limit,
      percent: usage.percent,
      tone: usage.isFull || usage.isOverCapacity ? "critical" : usage.percent >= 75 ? "warning" : "good",
    }));
}
