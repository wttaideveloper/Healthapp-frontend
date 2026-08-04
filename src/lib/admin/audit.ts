import type { IconName } from "@/components/ui/Icon";
import type { CsvSection } from "@/lib/admin/analytics/csv";
import { buildDateRange, isWithin, toTime, type RangeKey } from "@/lib/admin/analytics/range";
import type { AuditLog } from "@/types/admin";

/**
 * Pure helpers for the Audit Logs view.
 *
 * Search, filtering, sorting, and pagination all run client-side over the window
 * returned by `GET admin/audit-logs`, matching every other directory view in this
 * console. The date-range vocabulary is imported from the analytics module rather
 * than restated, so "Last 30 days" means the same thing everywhere.
 *
 * Nothing here invents an event. Filter option lists are derived from the rows
 * that actually came back, so a filter can never offer a value that matches
 * nothing.
 */

/* ------------------------------------------------------------ presentation */

/**
 * Human labels for the actions the backend records.
 *
 * Unknown keys are prettified rather than dropped: when a new action is added
 * server-side it shows up here immediately and legibly, without a frontend
 * release. That is the whole reason this is a lookup with a fallback and not an
 * exhaustive union.
 */
const actionLabels: Record<string, string> = {
  "auth.admin_login": "Admin signed in",
  "auth.password_reset": "Password reset",
  "admin.created": "Admin created",
  "admin.promoted": "User promoted to admin",
  "workspace.created": "Workspace created",
  "workspace.updated": "Workspace updated",
  "workspace.revoked": "Workspace revoked",
  "workspace.subscription_changed": "Subscription status changed",
  "workspace.provisioned_shopify": "Workspace provisioned (Shopify)",
  "workspace.cancelled_shopify": "Workspace cancelled (Shopify)",
  "member.invited": "Member invited",
  "member.joined": "Member joined",
  "member.role_changed": "Role changed",
  "member.restored": "Member restored",
  "member.removed": "Member removed",
  "invitation.revoked": "Invitation revoked",
};

export function auditActionLabel(action: string): string {
  const known = actionLabels[action];
  if (known) return known;

  // "billing.refund_issued" -> "Billing refund issued"
  const readable = action.replace(/[._]/g, " ").trim();
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

export type AuditCategory = "auth" | "admin" | "workspace" | "member" | "other";

export function auditActionCategory(action: string): AuditCategory {
  const prefix = action.split(".")[0];
  if (prefix === "auth") return "auth";
  if (prefix === "admin") return "admin";
  if (prefix === "workspace") return "workspace";
  if (prefix === "member" || prefix === "invitation") return "member";
  return "other";
}

const categoryIcons: Record<AuditCategory, IconName> = {
  auth: "lock",
  admin: "shield",
  workspace: "building",
  member: "users",
  other: "activity",
};

export function auditActionIcon(action: string): IconName {
  return categoryIcons[auditActionCategory(action)];
}

/** Resource column text: the target's label, falling back to its type and id. */
export function auditResourceLabel(log: AuditLog): string {
  if (log.targetLabel) return log.targetLabel;
  if (log.targetType && log.targetId) return `${log.targetType} ${log.targetId.slice(0, 8)}`;
  if (log.targetType) return log.targetType;
  return "—";
}

/** Actor column text. System actions genuinely have no actor — say so. */
export function auditActorLabel(log: AuditLog): string {
  return log.actorEmail ?? "System";
}

export function isSystemActor(log: AuditLog): boolean {
  return !log.actorEmail && !log.actorUserId;
}

/* --------------------------------------------------------------- filtering */

export type AuditResultFilter = "all" | "success" | "failure";

export type AuditFilterState = {
  search: string;
  action: string;
  workspaceId: string;
  result: AuditResultFilter;
  range: RangeKey;
};

/**
 * Defaults show everything that was loaded.
 *
 * A date default would silently hide audit records on first paint, with only a
 * filter chip to hint at it. For a compliance surface that is the wrong bias:
 * narrowing must be a deliberate act, never the starting state.
 */
export const defaultAuditFilters: AuditFilterState = {
  search: "",
  action: "all",
  workspaceId: "all",
  result: "all",
  range: "all",
};

export function countActiveAuditFilters(filters: AuditFilterState): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.action !== "all") count += 1;
  if (filters.workspaceId !== "all") count += 1;
  if (filters.result !== "all") count += 1;
  if (filters.range !== "all") count += 1;
  return count;
}

/**
 * Filter option lists, derived from the loaded rows.
 *
 * Counts ride along so an administrator can see how much each option covers
 * before selecting it.
 */
export function buildAuditFilterOptions(logs: AuditLog[]): {
  actions: Array<{ value: string; label: string; count: number }>;
  workspaces: Array<{ value: string; label: string; count: number }>;
  hasFailures: boolean;
} {
  const actionCounts = new Map<string, number>();
  const workspaceCounts = new Map<string, { label: string; count: number }>();
  let hasFailures = false;

  for (const log of logs) {
    actionCounts.set(log.action, (actionCounts.get(log.action) ?? 0) + 1);
    if (log.result === "failure") hasFailures = true;

    if (log.workspaceId) {
      const existing = workspaceCounts.get(log.workspaceId);
      workspaceCounts.set(log.workspaceId, {
        // Later rows are older; keep the first (newest) non-null name we saw.
        label: existing?.label ?? log.workspaceName ?? log.workspaceId.slice(0, 8),
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  return {
    actions: [...actionCounts.entries()]
      .map(([value, count]) => ({ value, label: auditActionLabel(value), count }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    workspaces: [...workspaceCounts.entries()]
      .map(([value, entry]) => ({ value, label: entry.label, count: entry.count }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
    hasFailures,
  };
}

function matchesSearch(log: AuditLog, needle: string): boolean {
  if (!needle) return true;
  return (
    (log.actorEmail?.toLowerCase().includes(needle) ?? false) ||
    auditActionLabel(log.action).toLowerCase().includes(needle) ||
    log.action.toLowerCase().includes(needle) ||
    (log.workspaceName?.toLowerCase().includes(needle) ?? false) ||
    (log.targetLabel?.toLowerCase().includes(needle) ?? false) ||
    (log.targetType?.toLowerCase().includes(needle) ?? false) ||
    (log.targetId?.toLowerCase().includes(needle) ?? false)
  );
}

export function filterAuditLogs(
  logs: AuditLog[],
  filters: AuditFilterState,
  now: number = Date.now(),
): AuditLog[] {
  const needle = filters.search.trim().toLowerCase();
  const range = buildDateRange(filters.range, now);

  if (
    !needle &&
    filters.action === "all" &&
    filters.workspaceId === "all" &&
    filters.result === "all" &&
    range.since === null
  ) {
    return logs;
  }

  return logs.filter((log) => {
    if (filters.action !== "all" && log.action !== filters.action) return false;
    if (filters.workspaceId !== "all" && log.workspaceId !== filters.workspaceId) return false;
    if (filters.result !== "all" && log.result !== filters.result) return false;

    if (range.since !== null) {
      const time = toTime(log.createdAt);
      // A row with an unparseable timestamp is kept rather than silently dropped:
      // hiding an audit record is worse than showing one out of range.
      if (time !== null && !isWithin(time, range.since, range.until)) return false;
    }

    return matchesSearch(log, needle);
  });
}

/* ----------------------------------------------------------------- sorting */

export type AuditSortKey = "newest" | "oldest" | "action" | "actor";

export const auditSortOptions: ReadonlyArray<{ value: AuditSortKey; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "action", label: "Action A–Z" },
  { value: "actor", label: "Actor A–Z" },
];

export function isAuditSortKey(value: unknown): value is AuditSortKey {
  return value === "newest" || value === "oldest" || value === "action" || value === "actor";
}

export function sortAuditLogs(logs: AuditLog[], key: AuditSortKey): AuditLog[] {
  const timeOf = (log: AuditLog) => toTime(log.createdAt) ?? 0;
  // Copy first: the input is React state and must not be mutated.
  const sorted = [...logs];

  switch (key) {
    case "oldest":
      return sorted.sort((a, b) => timeOf(a) - timeOf(b));
    case "action":
      return sorted.sort(
        (a, b) =>
          auditActionLabel(a.action).localeCompare(auditActionLabel(b.action), undefined, {
            sensitivity: "base",
          }) || timeOf(b) - timeOf(a),
      );
    case "actor":
      return sorted.sort(
        (a, b) =>
          auditActorLabel(a).localeCompare(auditActorLabel(b), undefined, { sensitivity: "base" }) ||
          timeOf(b) - timeOf(a),
      );
    default:
      return sorted.sort((a, b) => timeOf(b) - timeOf(a));
  }
}

/* -------------------------------------------------------------------- csv */

/**
 * Exports exactly the rows currently displayed — same filters, same order.
 * Reuses the shared CSV serializer, which already neutralises formula injection.
 */
export function buildAuditCsvSection(rows: AuditLog[]): CsvSection {
  return {
    title: "HealthAge Audit Log",
    headers: [
      "Timestamp (ISO)",
      "Action",
      "Action key",
      "Actor",
      "Actor role",
      "Resource",
      "Resource type",
      "Resource ID",
      "Workspace",
      "Workspace ID",
      "Result",
      "Metadata",
    ],
    rows: rows.map((log) => [
      log.createdAt,
      auditActionLabel(log.action),
      log.action,
      auditActorLabel(log),
      log.actorRole ?? "",
      auditResourceLabel(log),
      log.targetType ?? "",
      log.targetId ?? "",
      log.workspaceName ?? "",
      log.workspaceId ?? "",
      log.result,
      log.metadata === null || log.metadata === undefined ? "" : JSON.stringify(log.metadata),
    ]),
  };
}

/* --------------------------------------------------------------- metadata */

/** Pretty-printed metadata for the drawer, or null when there is none. */
export function formatAuditMetadata(metadata: unknown): string | null {
  if (metadata === null || metadata === undefined) return null;
  if (typeof metadata === "object" && Object.keys(metadata as object).length === 0) return null;

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

/**
 * Field-change rows when metadata carries a `changes` diff.
 *
 * Update actions store `{ changes: { seatLimit: { from, to } } }`; rendering that
 * as a table is far more readable than raw JSON, so the drawer shows both.
 */
export function extractAuditChanges(
  metadata: unknown,
): Array<{ field: string; from: string; to: string }> | null {
  if (!metadata || typeof metadata !== "object") return null;
  const changes = (metadata as { changes?: unknown }).changes;
  if (!changes || typeof changes !== "object") return null;

  const rows = Object.entries(changes as Record<string, unknown>).flatMap(([field, value]) => {
    if (!value || typeof value !== "object") return [];
    const entry = value as { from?: unknown; to?: unknown };
    if (!("from" in entry) || !("to" in entry)) return [];
    return [{ field, from: displayValue(entry.from), to: displayValue(entry.to) }];
  });

  return rows.length > 0 ? rows : null;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
