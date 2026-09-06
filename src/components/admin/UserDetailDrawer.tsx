"use client";

import { useMemo, type ReactNode } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { RoleBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/format";
import { findOwnedWorkspaces, type UserDeactivateCapabilities, type UserPermanentDeleteCapabilities } from "@/lib/admin/users";
import type { AdminUser, Workspace } from "@/types/admin";

type UserDetailDrawerProps = {
  user: AdminUser | null;
  workspaces: Workspace[];
  /** True when the signed-in account can call admin-only mutations. */
  canManage: boolean;
  isBusy: boolean;
  deactivate: UserDeactivateCapabilities | null;
  permanentDelete: UserPermanentDeleteCapabilities | null;
  onClose: () => void;
  onCopy: (value: string, label: string) => void;
  onPromote: ((user: AdminUser) => void) | null;
  onDeactivate: ((user: AdminUser) => void) | null;
  onPermanentlyDelete: ((user: AdminUser) => void) | null;
};

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[0.8125rem] text-[color:var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 text-right text-[0.8125rem] font-medium text-[color:var(--foreground)]">{children}</dd>
    </div>
  );
}

/** Used wherever the backend simply does not return the field. */
function Unavailable({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-normal text-[color:var(--text-subtle)]">
      <Icon name="lock" size={12} />
      {reason}
    </span>
  );
}

export function UserDetailDrawer({
  user,
  workspaces,
  canManage,
  isBusy,
  deactivate,
  onClose,
  onCopy,
  onPromote,
  onDeactivate,
  onPermanentlyDelete,
  permanentDelete,
}: UserDetailDrawerProps) {
  const ownedWorkspaces = useMemo(
    () => (user ? findOwnedWorkspaces(user, workspaces) : []),
    [user, workspaces],
  );

  if (!user) return null;

  const canPromote = canManage && onPromote !== null && user.role !== "admin" && user.status !== "disabled";
  const canDeactivate = onDeactivate !== null && (deactivate?.canDeactivate ?? false);
  const canPermanentlyDelete = onPermanentlyDelete !== null && (permanentDelete?.canPermanentlyDelete ?? false);

  return (
    <Drawer
      open={Boolean(user)}
      onClose={onClose}
      title={user.name}
      subtitle={user.email}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCopy(user.email, "Email")}
            className="ha-btn ha-btn-secondary ha-btn-sm"
          >
            <Icon name="copy" size={13} />
            Copy email
          </button>
          {canPromote ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => onPromote?.(user)}
              className="ha-btn ha-btn-primary ha-btn-sm"
            >
              <Icon name="shield" size={13} />
              Promote to admin
            </button>
          ) : null}
          {onDeactivate ? (
            <button
              type="button"
              disabled={!canDeactivate || isBusy}
              title={deactivate?.blockedReason ?? "Deactivate this user"}
              onClick={() => onDeactivate(user)}
              className="ha-btn ha-btn-danger ha-btn-sm"
            >
              <Icon name="ban" size={13} />
              Deactivate user
            </button>
          ) : null}
          {onPermanentlyDelete ? (
            <button
              type="button"
              disabled={!canPermanentlyDelete || isBusy}
              title={permanentDelete?.blockedReason ?? "Permanently delete this user"}
              onClick={() => onPermanentlyDelete(user)}
              className="ha-btn ha-btn-danger ha-btn-sm"
            >
              <Icon name="trash" size={13} />
              Permanently Delete
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="ha-btn ha-btn-ghost ha-btn-sm ml-auto">
            Close
          </button>
        </div>
      }
    >
      {/* Identity ------------------------------------------------ */}
      <div className="flex items-center gap-3.5">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-[-0.01em]">{user.name}</p>
          <button
            type="button"
            onClick={() => onCopy(user.email, "Email")}
            title="Copy email address"
            className="group mt-0.5 flex max-w-full items-center gap-1.5 rounded text-[0.8125rem] text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
          >
            <span className="truncate">{user.email}</span>
            <Icon name="copy" size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <RoleBadge value={user.role} />
            <StatusBadge value={user.status} />
          </div>
        </div>
      </div>

      {/* Access -------------------------------------------------- */}
      <section className="mt-6">
        <h3 className="ha-eyebrow">Access</h3>
        <dl className="mt-1.5 divide-y divide-[color:var(--border)]">
          <DetailRow label="Subscription">
            <span className={`ha-badge ${user.hasAccess ? "ha-badge-success" : "ha-badge-neutral"}`}>
              {user.hasAccess ? "Has access" : "No access"}
            </span>
          </DetailRow>
          <DetailRow label="Access source">
            <Unavailable reason="Not returned by admin/users" />
          </DetailRow>
          <DetailRow label="Email verified">
            <span className={`ha-badge ${user.isEmailVerified ? "ha-badge-success" : "ha-badge-warning"}`}>
              {user.isEmailVerified ? "Verified" : "Unverified"}
            </span>
          </DetailRow>
        </dl>
      </section>

      {/* Workspaces ---------------------------------------------- */}
      <section className="mt-6">
        <h3 className="ha-eyebrow">Workspaces</h3>
        <dl className="mt-1.5 divide-y divide-[color:var(--border)]">
          <DetailRow label="Owned workspaces">
            <span className="tabular-nums">{ownedWorkspaces.length}</span>
          </DetailRow>
          <DetailRow label="Member of">
            <Unavailable reason="Requires per-workspace lookup" />
          </DetailRow>
        </dl>

        {ownedWorkspaces.length > 0 ? (
          <ul className="mt-2.5 space-y-1.5">
            {ownedWorkspaces.map((workspace) => (
              <li
                key={workspace.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card-2)] px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] font-medium">{workspace.name}</span>
                  <span className="block text-xs tabular-nums text-[color:var(--text-muted)]">
                    {workspace.activeSeatCount}/{workspace.seatLimit ?? "∞"} seats
                  </span>
                </span>
                <StatusBadge value={workspace.subscriptionStatus} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2.5 rounded-lg bg-[color:var(--muted)] px-3 py-2 text-xs leading-relaxed text-[color:var(--text-subtle)]">
            This user does not own any workspace. Ownership is derived from the loaded workspace list; seat-level
            membership is not exposed by <code className="font-mono">admin/users</code>.
          </p>
        )}
      </section>

      {/* Account ------------------------------------------------- */}
      <section className="mt-6">
        <h3 className="ha-eyebrow">Account</h3>
        <dl className="mt-1.5 divide-y divide-[color:var(--border)]">
          <DetailRow label="Created">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" size={12} className="text-[color:var(--text-subtle)]" />
              {formatDateTime(user.createdAt)}
            </span>
          </DetailRow>
          <DetailRow label="User ID">
            <button
              type="button"
              onClick={() => onCopy(user.id, "User ID")}
              title="Copy user ID"
              className="group flex items-center gap-1.5 rounded font-mono text-xs text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)]"
            >
              <span className="truncate">{user.id}</span>
              <Icon name="copy" size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </DetailRow>
        </dl>
      </section>

      {user.status === "disabled" ? (
        <p className="mt-5 flex items-start gap-2 rounded-lg border border-[color:rgba(185,28,28,0.22)] bg-[color:var(--danger-soft)] px-3 py-2.5 text-xs leading-relaxed text-[color:var(--danger)]">
          <span className="mt-0.5 shrink-0">
            <Icon name="ban" size={13} />
          </span>
          This account is deactivated. The user cannot log in. Workspace memberships were revoked. Billing records and
          device reports were not deleted.
        </p>
      ) : null}

      {user.role === "admin" && user.status !== "disabled" ? (
        <p className="mt-5 flex items-start gap-2 rounded-lg border border-[color:rgba(180,83,9,0.22)] bg-[color:var(--warning-soft)] px-3 py-2.5 text-xs leading-relaxed text-[color:var(--warning)]">
          <span className="mt-0.5 shrink-0">
            <Icon name="shield" size={13} />
          </span>
          This account is a platform administrator with full access to every workspace. The API exposes no demotion
          endpoint, so removing admin rights requires a direct database change.
        </p>
      ) : null}
    </Drawer>
  );
}
