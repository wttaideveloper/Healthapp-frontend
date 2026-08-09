"use client";

import { FormEvent, useMemo, type ReactNode } from "react";

import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { SeatUsageBar } from "@/components/ui/SeatUsageBar";
import { EmptyState } from "@/components/ui/Section";
import { RoleBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime, formatFriendlyDate } from "@/lib/format";
import { getInitials } from "@/lib/admin/users";
import {
  describeEntitlementBlock,
  getSeatUsage,
  isWorkspaceEntitled,
  orderMembersForDisplay,
  resolveOwner,
  summarizeMembers,
  type OwnerIndex,
} from "@/lib/admin/workspaces";
import type { Workspace, WorkspaceMember } from "@/types/admin";

type WorkspaceDetailDrawerProps = {
  workspace: Workspace | null;
  ownerIndex: OwnerIndex;
  members: WorkspaceMember[];
  isLoadingMembers: boolean;
  isBusy: boolean;
  onClose: () => void;
  onCopy: (value: string, label: string) => void;
  // Invite form — reuses the existing `onAddMember` handler and its state.
  canInvite: boolean;
  memberEmail: string;
  setMemberEmail: (value: string) => void;
  memberRole: string;
  setMemberRole: (value: string) => void;
  onAddMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[0.8125rem] text-[color:var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 text-right text-[0.8125rem] font-medium text-[color:var(--foreground)]">{children}</dd>
    </div>
  );
}

function Unavailable({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-normal text-[color:var(--text-subtle)]">
      <Icon name="lock" size={12} />
      {reason}
    </span>
  );
}

function CopyableText({
  value,
  label,
  onCopy,
  mono = false,
}: {
  value: string;
  label: string;
  onCopy: (value: string, label: string) => void;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value, label)}
      title={`Copy ${label.toLowerCase()}`}
      aria-label={`Copy ${label.toLowerCase()}`}
      className={`group flex max-w-full items-center gap-1.5 rounded transition-colors hover:text-[color:var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent)] ${
        mono ? "font-mono text-xs text-[color:var(--text-muted)]" : ""
      }`}
    >
      <span className="truncate">{value}</span>
      <Icon name="copy" size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

export function WorkspaceDetailDrawer(props: WorkspaceDetailDrawerProps) {
  const { workspace, members, onCopy } = props;

  const owner = useMemo(
    () => (workspace ? resolveOwner(workspace, props.ownerIndex) : null),
    [workspace, props.ownerIndex],
  );
  const usage = useMemo(() => (workspace ? getSeatUsage(workspace) : null), [workspace]);
  const breakdown = useMemo(() => summarizeMembers(members), [members]);
  const orderedMembers = useMemo(() => orderMembersForDisplay(members), [members]);

  if (!workspace || !owner || !usage) return null;

  const entitled = isWorkspaceEntitled(workspace);
  const blockReason = describeEntitlementBlock(workspace);

  return (
    <Drawer
      open={Boolean(workspace)}
      onClose={props.onClose}
      title={workspace.name}
      subtitle={owner.name ? `${owner.name} · ${owner.email}` : owner.email}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCopy(workspace.id, "Workspace ID")}
            className="ha-btn ha-btn-secondary ha-btn-sm"
          >
            <Icon name="copy" size={13} />
            Copy ID
          </button>
          <button
            type="button"
            onClick={() => onCopy(owner.email, "Owner email")}
            className="ha-btn ha-btn-secondary ha-btn-sm"
          >
            <Icon name="mail" size={13} />
            Copy owner email
          </button>
          <button type="button" onClick={props.onClose} className="ha-btn ha-btn-ghost ha-btn-sm ml-auto">
            Close
          </button>
        </div>
      }
    >
      {/* Access summary ----------------------------------------- */}
      <div
        className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5"
        style={
          entitled
            ? { background: "var(--success-soft)", borderColor: "rgba(5,150,105,0.22)" }
            : { background: "var(--warning-soft)", borderColor: "rgba(180,83,9,0.22)" }
        }
      >
        <span className="mt-0.5 shrink-0" style={{ color: entitled ? "var(--success)" : "var(--warning)" }}>
          <Icon name={entitled ? "badgeCheck" : "alert"} size={15} />
        </span>
        <div className="min-w-0">
          <p
            className="text-[0.8125rem] font-semibold"
            style={{ color: entitled ? "var(--success)" : "var(--warning)" }}
          >
            {entitled ? "Members have Pro access" : "Members do not have Pro access"}
          </p>
          {blockReason ? (
            <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--warning)" }}>
              {blockReason}.
            </p>
          ) : null}
        </div>
      </div>

      {/* Seats --------------------------------------------------- */}
      <section className="mt-5">
        <h3 className="ha-eyebrow">Seat utilization</h3>
        <div className="mt-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card-2)] p-3.5">
          <SeatUsageBar usage={usage} showCaption label={workspace.name} />
          <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[color:var(--border)] pt-3 text-center">
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-wide text-[color:var(--text-subtle)]">Used</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums">{usage.used}</dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-wide text-[color:var(--text-subtle)]">Available</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums">
                {usage.isUnlimited ? "∞" : usage.available}
              </dd>
            </div>
            <div>
              <dt className="text-[0.6875rem] uppercase tracking-wide text-[color:var(--text-subtle)]">Limit</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums">
                {usage.isUnlimited ? "∞" : usage.limit}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Overview ------------------------------------------------ */}
      <section className="mt-5">
        <h3 className="ha-eyebrow">Overview</h3>
        <dl className="mt-1.5 divide-y divide-[color:var(--border)]">
          <DetailRow label="Owner">
            {owner.name ? (
              owner.name
            ) : (
              <span className="font-normal text-[color:var(--text-subtle)]">No registered account yet</span>
            )}
          </DetailRow>
          <DetailRow label="Owner email">
            <CopyableText value={owner.email} label="Owner email" onCopy={onCopy} />
          </DetailRow>
          <DetailRow label="Workspace status">
            <StatusBadge value={workspace.status} />
          </DetailRow>
          <DetailRow label="Subscription">
            <StatusBadge value={workspace.subscriptionStatus} />
          </DetailRow>
          <DetailRow label="Plan">
            <span className="ha-badge ha-badge-neutral">{workspace.plan}</span>
          </DetailRow>
          <DetailRow label="Billing source">
            <Unavailable reason="Not returned by admin/workspaces" />
          </DetailRow>
        </dl>
      </section>

      {/* Members ------------------------------------------------- */}
      <section className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="ha-eyebrow">Members</h3>
          {members.length > 0 ? (
            <span className="text-xs text-[color:var(--text-muted)]">
              {breakdown.active} active · {breakdown.invited} invited
            </span>
          ) : null}
        </div>

        {props.isLoadingMembers ? (
          <ul className="mt-2 space-y-1.5">
            {[0, 1, 2].map((row) => (
              <li key={row} className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] p-2.5">
                <div className="ha-skeleton h-7 w-7 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="ha-skeleton h-3 w-2/3" />
                  <div className="ha-skeleton mt-1.5 h-2.5 w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        ) : orderedMembers.length === 0 ? (
          <div className="mt-2 rounded-xl border border-dashed border-[color:var(--border-strong)]">
            <EmptyState
              icon="users"
              title="No members yet"
              description="Invite someone by email — the seat activates automatically when they sign up."
            />
          </div>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {orderedMembers.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5"
              >
                <span
                  aria-hidden="true"
                  style={
                    member.role === "owner"
                      ? { background: "var(--accent)", color: "#fff" }
                      : { background: "var(--muted)", color: "var(--text-muted)" }
                  }
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-semibold"
                >
                  {getInitials(member.email.split("@")[0] ?? member.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-medium">{member.email}</span>
                  <span className="block text-xs text-[color:var(--text-muted)]">
                    {member.joinedAt ? `Joined ${formatDateTime(member.joinedAt)}` : "Awaiting sign-up"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <RoleBadge value={member.role} />
                  <StatusBadge value={member.status} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {props.canInvite ? (
          <form onSubmit={props.onAddMember} className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card-2)] p-3">
            <p className="ha-label mb-2">Invite a member</p>
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="drawer-member-email">
                Member email
              </label>
              <input
                id="drawer-member-email"
                type="email"
                required
                value={props.memberEmail}
                onChange={(event) => props.setMemberEmail(event.target.value)}
                placeholder="member@clinic.com"
                className="ha-input min-w-0 flex-1"
              />
              <label className="sr-only" htmlFor="drawer-member-role">
                Member role
              </label>
              <select
                id="drawer-member-role"
                value={props.memberRole}
                onChange={(event) => props.setMemberRole(event.target.value)}
                className="ha-input w-auto"
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
              <button type="submit" disabled={props.isBusy} className="ha-btn ha-btn-primary">
                <Icon name="userPlus" size={14} />
                {props.isBusy ? "Working…" : "Invite"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {/* Lifecycle ----------------------------------------------- */}
      <section className="mt-5">
        <h3 className="ha-eyebrow">Lifecycle</h3>
        <dl className="mt-1.5 divide-y divide-[color:var(--border)]">
          <DetailRow label="Created">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" size={12} className="text-[color:var(--text-subtle)]" />
              {formatDateTime(workspace.createdAt)}
            </span>
          </DetailRow>
          <DetailRow label="Expires">
            {workspace.expiresAt ? (
              formatFriendlyDate(workspace.expiresAt)
            ) : (
              <span className="font-normal text-[color:var(--text-subtle)]">No expiry set</span>
            )}
          </DetailRow>
          <DetailRow label="Last updated">{formatDateTime(workspace.updatedAt)}</DetailRow>
          {workspace.revokedAt ? (
            <DetailRow label="Revoked">
              <span className="text-[color:var(--danger)]">{formatDateTime(workspace.revokedAt)}</span>
            </DetailRow>
          ) : null}
          <DetailRow label="Workspace ID">
            <CopyableText value={workspace.id} label="Workspace ID" onCopy={onCopy} mono />
          </DetailRow>
        </dl>
      </section>

      {workspace.notes ? (
        <section className="mt-5">
          <h3 className="ha-eyebrow">Notes</h3>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[color:var(--muted)] px-3 py-2.5 text-[0.8125rem] leading-relaxed text-[color:var(--text-muted)]">
            {workspace.notes}
          </p>
        </section>
      ) : null}
    </Drawer>
  );
}
