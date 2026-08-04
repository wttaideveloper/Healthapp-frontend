import type { AdminUser, Workspace, WorkspaceMember } from "@/types/admin";
import type { IconName } from "@/components/ui/Icon";

/**
 * Recent activity feed.
 *
 * BACKEND DEPENDENCY: the API exposes no audit-log / activity endpoint today,
 * so this module does NOT invent events. It derives a feed purely from
 * timestamps that already exist on records returned by the current endpoints
 * (`admin/workspaces`, `admin/users`, workspace member lists).
 *
 * Consequences of deriving rather than querying:
 *  - only creation/update/join/revoke moments are representable
 *  - member events are limited to the workspace whose members are loaded
 *  - deletions leave no trace
 *
 * Replacing this with a real `GET /api/v1/admin/activity` feed would remove all
 * three limitations. See `ACTIVITY_BACKEND_NOTE`.
 */

export const ACTIVITY_BACKEND_NOTE =
  "Derived from record timestamps. A dedicated activity/audit endpoint would give a complete, platform-wide history.";

export type ActivityTone = "accent" | "info" | "warning" | "neutral";

export type ActivityItem = {
  id: string;
  icon: IconName;
  tone: ActivityTone;
  title: string;
  detail: string | null;
  timestamp: string;
  time: number;
};

function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Treats near-identical created/updated stamps as "not really an edit" so a
 * freshly created record does not produce two feed rows.
 */
function isMeaningfulUpdate(createdAt: string, updatedAt: string): boolean {
  const created = toTime(createdAt);
  const updated = toTime(updatedAt);
  if (created === null || updated === null) return false;
  return updated - created > 1000;
}

export function buildRecentActivity(input: {
  workspaces: Workspace[];
  users: AdminUser[];
  members: WorkspaceMember[];
  memberWorkspaceName: string | null;
  limit?: number;
}): ActivityItem[] {
  const { workspaces, users, members, memberWorkspaceName, limit = 8 } = input;
  const items: ActivityItem[] = [];

  const push = (item: Omit<ActivityItem, "time"> & { timestamp: string }) => {
    const time = toTime(item.timestamp);
    if (time === null) return;
    items.push({ ...item, time });
  };

  for (const workspace of workspaces) {
    push({
      id: `workspace-created-${workspace.id}`,
      icon: "building",
      tone: "accent",
      title: `Workspace “${workspace.name}” created`,
      detail: workspace.ownerEmail ? `Owner ${workspace.ownerEmail}` : null,
      timestamp: workspace.createdAt,
    });

    if (isMeaningfulUpdate(workspace.createdAt, workspace.updatedAt)) {
      push({
        id: `workspace-updated-${workspace.id}`,
        icon: "refresh",
        tone: "info",
        title: `Workspace “${workspace.name}” updated`,
        detail: `Status ${workspace.status} · subscription ${workspace.subscriptionStatus}`,
        timestamp: workspace.updatedAt,
      });
    }

    if (workspace.revokedAt) {
      push({
        id: `workspace-revoked-${workspace.id}`,
        icon: "alert",
        tone: "warning",
        title: `Workspace “${workspace.name}” revoked`,
        detail: null,
        timestamp: workspace.revokedAt,
      });
    }
  }

  for (const user of users) {
    push({
      id: `user-created-${user.id}`,
      icon: user.role === "admin" ? "shield" : "users",
      tone: user.role === "admin" ? "warning" : "neutral",
      title: user.role === "admin" ? `Admin ${user.name} added` : `${user.name} registered`,
      detail: user.email,
      timestamp: user.createdAt,
    });
  }

  const scope = memberWorkspaceName ? ` in “${memberWorkspaceName}”` : "";
  for (const member of members) {
    if (member.revokedAt) {
      push({
        id: `member-revoked-${member.id}`,
        icon: "x",
        tone: "warning",
        title: `${member.email} revoked${scope}`,
        detail: null,
        timestamp: member.revokedAt,
      });
      continue;
    }

    if (member.joinedAt) {
      push({
        id: `member-joined-${member.id}`,
        icon: "check",
        tone: "accent",
        title: `${member.email} joined${scope}`,
        detail: `Role ${member.role}`,
        timestamp: member.joinedAt,
      });
      continue;
    }

    if (member.status === "invited") {
      push({
        id: `member-invited-${member.id}`,
        icon: "mailClock",
        tone: "info",
        title: `${member.email} invited${scope}`,
        detail: `Role ${member.role} · awaiting sign-up`,
        timestamp: member.createdAt,
      });
    }
  }

  return items.sort((a, b) => b.time - a.time).slice(0, limit);
}

export function formatRelativeTime(time: number, now: number = Date.now()): string {
  const diff = now - time;
  if (diff < 0) return "just now";

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "just now";
  if (diff < hour) {
    const value = Math.floor(diff / minute);
    return `${value}m ago`;
  }
  if (diff < day) {
    const value = Math.floor(diff / hour);
    return `${value}h ago`;
  }
  if (diff < 30 * day) {
    const value = Math.floor(diff / day);
    return `${value}d ago`;
  }

  return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
