"use client";

import { useMemo, type ReactNode } from "react";

import { Avatar } from "@/components/ui/Avatar";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { RoleBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import { formatRelativeTime } from "@/lib/admin/activity";
import {
  buildMemberTimeline,
  getInvitationAgeDays,
  getMemberCapabilities,
  getMemberPermanentDeleteCapabilities,
  occupiesSeat,
  resolveMemberIdentity,
  unsupportedMemberActions,
  type MemberIdentityIndex,
} from "@/lib/admin/members";
import { formatDateTime } from "@/lib/format";
import type { Workspace, WorkspaceMember } from "@/types/admin";

type MemberDetailDrawerProps = {
  member: WorkspaceMember | null;
  workspace: Workspace | null;
  identityIndex: MemberIdentityIndex;
  isPlatformAdmin: boolean;
  isBusy: boolean;
  onClose: () => void;
  onCopy: (value: string, label: string) => void;
  onToggleRole: (member: WorkspaceMember) => void;
  onRevoke: (member: WorkspaceMember) => void;
  onPermanentlyDelete: ((member: WorkspaceMember) => void) | null;
  workspaceMembers: WorkspaceMember[];
  onReactivate: (member: WorkspaceMember) => void;
};

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[0.8125rem] text-text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-[0.8125rem] font-medium text-foreground">{children}</dd>
    </div>
  );
}

function Unavailable({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-normal text-text-subtle">
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
      aria-label={`Copy ${label.toLowerCase()}`}
      title={`Copy ${label.toLowerCase()}`}
      className={`group flex max-w-full items-center gap-1.5 rounded transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        mono ? "font-mono text-xs text-text-muted" : ""
      }`}
    >
      <span className="truncate">{value}</span>
      <Icon name="copy" size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

export function MemberDetailDrawer(props: MemberDetailDrawerProps) {
  const { member, workspace, onCopy } = props;

  const identity = useMemo(
    () => (member ? resolveMemberIdentity(member, props.identityIndex) : null),
    [member, props.identityIndex],
  );
  const timeline = useMemo(
    () => (member ? buildMemberTimeline(member, workspace?.name ?? null) : []),
    [member, workspace?.name],
  );

  if (!member || !identity) return null;

  const capabilities = getMemberCapabilities(member, props.isPlatformAdmin);
  const permanentDelete = getMemberPermanentDeleteCapabilities(
    member,
    props.isPlatformAdmin,
    workspace,
    props.workspaceMembers,
  );
  const inviteAge = getInvitationAgeDays(member);
  const hasSeat = occupiesSeat(member);

  const timelineItems: TimelineItem[] = timeline.map((event) => ({
    id: event.id,
    icon: event.icon,
    tone: event.tone,
    title: event.title,
    detail: event.detail,
    timestamp: event.timestamp,
    displayTime: formatRelativeTime(event.time),
  }));

  return (
    <Drawer
      open={Boolean(member)}
      onClose={props.onClose}
      title={identity.displayName}
      subtitle={identity.email}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCopy(identity.email, "Email")}
            className="ha-btn ha-btn-secondary ha-btn-sm"
          >
            <Icon name="mail" size={13} />
            Copy email
          </button>

          {capabilities.canChangeRole ? (
            <button
              type="button"
              disabled={props.isBusy}
              onClick={() => props.onToggleRole(member)}
              className="ha-btn ha-btn-secondary ha-btn-sm"
            >
              <Icon name="shield" size={13} />
              {member.role === "member" ? "Make admin" : "Make member"}
            </button>
          ) : null}

          {capabilities.canReactivate ? (
            <button
              type="button"
              disabled={props.isBusy}
              onClick={() => props.onReactivate(member)}
              className="ha-btn ha-btn-primary ha-btn-sm"
            >
              <Icon name="check" size={13} />
              Restore access
            </button>
          ) : null}

          {capabilities.canRevoke ? (
            <button
              type="button"
              disabled={props.isBusy}
              onClick={() => props.onRevoke(member)}
              className="ha-btn ha-btn-danger ha-btn-sm"
            >
              <Icon name="ban" size={13} />
              Revoke
            </button>
          ) : null}

          {props.onPermanentlyDelete ? (
            <button
              type="button"
              disabled={props.isBusy || !permanentDelete.canPermanentlyDelete}
              title={permanentDelete.blockedReason ?? "Permanently delete this seat"}
              onClick={() => props.onPermanentlyDelete?.(member)}
              className="ha-btn ha-btn-danger ha-btn-sm"
            >
              <Icon name="trash" size={13} />
              Permanently Delete
            </button>
          ) : null}

          <button type="button" onClick={props.onClose} className="ha-btn ha-btn-ghost ha-btn-sm ml-auto">
            Close
          </button>
        </div>
      }
    >
      {/* Identity ------------------------------------------------ */}
      <div className="flex items-center gap-3.5">
        <Avatar name={identity.displayName} size="lg" tone={member.role === "owner" ? "accent" : "neutral"} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-[-0.01em]">{identity.displayName}</p>
          {!identity.name ? (
            <p className="mt-0.5 text-xs text-text-subtle">No registered account yet — name unavailable</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <RoleBadge value={member.role} />
            <StatusBadge value={member.status} />
            {identity.user?.isEmailVerified ? (
              <span className="ha-badge ha-badge-success">
                <Icon name="badgeCheck" size={11} />
                Email verified
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Pending invitation callout ------------------------------ */}
      {member.status === "invited" ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[rgba(180,83,9,0.22)] bg-(--warning-soft) px-3 py-2.5">
          <span className="mt-0.5 shrink-0 text-warning">
            <Icon name="mailClock" size={15} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-semibold text-warning">Invitation pending</p>
            <p className="mt-0.5 text-xs leading-relaxed text-warning">
              Sent {formatDateTime(member.createdAt)}
              {inviteAge !== null ? ` · ${inviteAge === 0 ? "today" : `${inviteAge} day${inviteAge === 1 ? "" : "s"} ago`}` : ""}.
              The seat is reserved and activates automatically when this person signs up.
            </p>
          </div>
        </div>
      ) : null}

      {/* Membership ---------------------------------------------- */}
      <section className="mt-5">
        <h3 className="ha-eyebrow">Membership</h3>
        <dl className="mt-1.5 divide-y divide-border">
          <DetailRow label="Email">
            <CopyableText value={identity.email} label="Email" onCopy={onCopy} />
          </DetailRow>
          <DetailRow label="Role">
            <RoleBadge value={member.role} />
          </DetailRow>
          <DetailRow label="Status">
            <StatusBadge value={member.status} />
          </DetailRow>
          <DetailRow label="Workspace">
            {workspace ? workspace.name : <Unavailable reason="No workspace loaded" />}
          </DetailRow>
          <DetailRow label="Seat">
            <span className={`ha-badge ${hasSeat ? "ha-badge-success" : "ha-badge-neutral"}`}>
              {hasSeat ? "Occupies a seat" : "No seat"}
            </span>
          </DetailRow>
          {workspace ? (
            <DetailRow label="Workspace seats">
              <span className="tabular-nums">
                {workspace.activeSeatCount}/{workspace.seatLimit ?? "∞"}
              </span>
            </DetailRow>
          ) : null}
          <DetailRow label="Invited by">
            {member.invitedByUserId ? (
              (props.identityIndex.byId.get(member.invitedByUserId)?.name ?? (
                <span className="font-mono text-xs text-text-muted">{member.invitedByUserId}</span>
              ))
            ) : (
              <Unavailable reason="Not recorded" />
            )}
          </DetailRow>
        </dl>
      </section>

      {/* Timeline ------------------------------------------------ */}
      <section className="mt-5">
        <h3 className="ha-eyebrow">Timeline</h3>
        <div className="mt-2.5">
          {timelineItems.length > 0 ? (
            <Timeline items={timelineItems} label={`Lifecycle events for ${identity.email}`} />
          ) : (
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-text-subtle">
              No dated lifecycle events are available for this member.
            </p>
          )}
        </div>
      </section>

      {/* Dates --------------------------------------------------- */}
      <section className="mt-5">
        <h3 className="ha-eyebrow">Dates</h3>
        <dl className="mt-1.5 divide-y divide-border">
          <DetailRow label="Invitation sent">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" size={12} className="text-text-subtle" />
              {formatDateTime(member.createdAt)}
            </span>
          </DetailRow>
          <DetailRow label="Joined">
            {member.joinedAt ? (
              formatDateTime(member.joinedAt)
            ) : (
              <span className="font-normal text-text-subtle">Not joined yet</span>
            )}
          </DetailRow>
          {member.revokedAt ? (
            <DetailRow label="Revoked">
              <span className="text-danger">{formatDateTime(member.revokedAt)}</span>
            </DetailRow>
          ) : null}
          <DetailRow label="Last updated">{formatDateTime(member.updatedAt)}</DetailRow>
          <DetailRow label="Member ID">
            <CopyableText value={member.id} label="Member ID" onCopy={onCopy} mono />
          </DetailRow>
          <DetailRow label="Account ID">
            {member.userId ? (
              <CopyableText value={member.userId} label="Account ID" onCopy={onCopy} mono />
            ) : (
              <Unavailable reason="No account linked yet" />
            )}
          </DetailRow>
        </dl>
      </section>

      {/* Unsupported actions ------------------------------------- */}
      <section className="mt-5">
        <h3 className="ha-eyebrow">Unavailable actions</h3>
        <ul className="mt-2 space-y-1.5">
          {[
            { label: "Resend invitation", reason: unsupportedMemberActions.resendInvitation },
            { label: "Copy invitation link", reason: unsupportedMemberActions.invitationLink },
            { label: "Transfer ownership", reason: unsupportedMemberActions.transferOwnership },
          ].map((entry) => (
            <li
              key={entry.label}
              className="flex items-start gap-2.5 rounded-lg border border-dashed border-border-strong px-3 py-2"
            >
              <span className="mt-0.5 shrink-0 text-text-subtle">
                <Icon name="lock" size={13} />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-medium text-text-muted">{entry.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-text-subtle">{entry.reason}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {permanentDelete.blockedReason && props.onPermanentlyDelete ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-[rgba(180,83,9,0.22)] bg-(--warning-soft) px-3 py-2.5 text-xs leading-relaxed text-warning">
          <span className="mt-0.5 shrink-0">
            <Icon name="lock" size={13} />
          </span>
          {permanentDelete.blockedReason}
        </p>
      ) : null}

      {capabilities.blockedReason ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-[rgba(180,83,9,0.22)] bg-(--warning-soft) px-3 py-2.5 text-xs leading-relaxed text-warning">
          <span className="mt-0.5 shrink-0">
            <Icon name="shield" size={13} />
          </span>
          {capabilities.blockedReason}.
        </p>
      ) : null}
    </Drawer>
  );
}
