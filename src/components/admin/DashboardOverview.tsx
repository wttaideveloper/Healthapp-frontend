import { useMemo } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { MetricCard, type MetricState } from "@/components/ui/MetricCard";
import { EmptyState, SectionCard } from "@/components/ui/Section";
import { ACTIVITY_BACKEND_NOTE, buildRecentActivity, formatRelativeTime } from "@/lib/admin/activity";
import type {
  AdminUser,
  DashboardMetrics,
  EntitlementResponse,
  ViewMode,
  Workspace,
  WorkspaceMember,
} from "@/types/admin";

type DashboardOverviewProps = {
  metrics: DashboardMetrics;
  isPlatformAdmin: boolean;
  isLoadingDashboard: boolean;
  dashboardError: string | null;
  entitlement: EntitlementResponse | null;
  workspaces: Workspace[];
  users: AdminUser[];
  members: WorkspaceMember[];
  onRefreshData: () => void;
  setActiveView: (value: ViewMode) => void;
};

const activityToneStyles: Record<string, { bg: string; fg: string }> = {
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  info: { bg: "var(--info-soft)", fg: "var(--info)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
  neutral: { bg: "var(--muted)", fg: "var(--text-muted)" },
};

export function DashboardOverview(props: DashboardOverviewProps) {
  const { metrics, isPlatformAdmin, isLoadingDashboard, dashboardError } = props;

  // Skeletons are reserved for the first paint. Once any data has arrived a refresh
  // keeps the previous values on screen instead of flashing back to skeletons.
  const hasAnyData =
    props.workspaces.length > 0 || props.users.length > 0 || props.members.length > 0 || metrics.totalWorkspaces > 0;
  const baseState: MetricState = dashboardError
    ? "error"
    : isLoadingDashboard && !hasAnyData
      ? "loading"
      : "ready";

  const activity = useMemo(
    () =>
      buildRecentActivity({
        workspaces: props.workspaces,
        users: props.users,
        members: props.members,
        memberWorkspaceName: metrics.pendingInvitationsScope,
      }),
    [props.workspaces, props.users, props.members, metrics.pendingInvitationsScope],
  );

  const quickActions = useMemo(() => {
    const actions: Array<{
      key: string;
      label: string;
      description: string;
      icon: IconName;
      onClick: () => void;
      primary?: boolean;
    }> = [];

    if (isPlatformAdmin) {
      actions.push({
        key: "create-workspace",
        label: "Create Workspace",
        description: "Provision a paid organization",
        icon: "building",
        onClick: () => props.setActiveView("workspaces"),
        primary: true,
      });
      actions.push({
        key: "create-admin",
        label: "Create Admin",
        description: "Add a platform administrator",
        icon: "shield",
        onClick: () => props.setActiveView("users"),
      });
    }

    actions.push({
      key: "invite-user",
      label: "Invite User",
      description: "Add a member to a workspace",
      icon: "userPlus",
      onClick: () => props.setActiveView("members"),
      primary: !isPlatformAdmin,
    });

    actions.push({
      key: "refresh",
      label: "Refresh Dashboard",
      description: "Reload workspaces and members",
      icon: "refresh",
      onClick: props.onRefreshData,
    });

    return actions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlatformAdmin, props.setActiveView, props.onRefreshData]);

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------- KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Users"
          value={metrics.totalUsers}
          icon="users"
          tone="info"
          state={metrics.canReadAllUsers ? baseState : "unavailable"}
          hint={`${metrics.usersWithAccess.toLocaleString()} with active access`}
          emptyMessage="No users registered yet"
          errorMessage="Could not load users"
          unavailableMessage="Platform admin only"
        />
        <MetricCard
          label="Active Workspaces"
          value={metrics.activeWorkspaces}
          icon="building"
          tone="accent"
          state={baseState}
          hint={`of ${metrics.totalWorkspaces.toLocaleString()} total`}
          emptyMessage={isPlatformAdmin ? "Create your first workspace" : "No workspaces assigned"}
          errorMessage="Could not load workspaces"
        />
        <MetricCard
          label="Active Subscriptions"
          value={metrics.activeSubscriptions}
          icon="creditCard"
          tone="accent"
          state={baseState}
          hint={`${metrics.totalActiveSeats.toLocaleString()} seats in use`}
          emptyMessage="No active or trialing plans"
          errorMessage="Could not load subscriptions"
        />
        <MetricCard
          label="Pending Invitations"
          value={metrics.pendingInvitations}
          icon="mailClock"
          tone="warning"
          state={metrics.pendingInvitationsScope ? baseState : "unavailable"}
          hint={
            metrics.pendingInvitationsScope ? `In “${metrics.pendingInvitationsScope}”` : undefined
          }
          emptyMessage={
            metrics.pendingInvitationsScope
              ? `None pending in “${metrics.pendingInvitationsScope}”`
              : "No pending invitations"
          }
          errorMessage="Could not load members"
          unavailableMessage="Select a workspace"
        />
      </div>

      {dashboardError ? (
        <div
          role="alert"
          className="ha-card flex items-start gap-3 border-[color:rgba(220,38,38,0.3)] bg-[color:var(--danger-soft)] p-4"
        >
          <span className="mt-0.5 text-[color:var(--danger)]">
            <Icon name="alert" size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-semibold text-[color:var(--danger)]">Dashboard data failed to load</p>
            <p className="mt-1 text-xs leading-relaxed text-[color:var(--danger)] opacity-90">{dashboardError}</p>
          </div>
          <button type="button" onClick={props.onRefreshData} className="ha-btn ha-btn-secondary ha-btn-sm ml-auto">
            <Icon name="refresh" size={13} />
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* ------------------------------------------------ Recent activity */}
        <SectionCard
          title="Recent Activity"
          description="Latest changes across workspaces, members, and accounts"
          icon="activity"
          flush
        >
          {isLoadingDashboard && activity.length === 0 ? (
            <ul className="divide-y divide-[color:var(--border)]">
              {[0, 1, 2, 3].map((row) => (
                <li key={row} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="ha-skeleton h-8 w-8 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <div className="ha-skeleton h-3.5 w-1/2" />
                    <div className="ha-skeleton mt-2 h-3 w-1/3" />
                  </div>
                </li>
              ))}
            </ul>
          ) : activity.length === 0 ? (
            <EmptyState
              icon="activity"
              title="No activity available"
              description="Once workspaces, members, or accounts are created, their most recent changes will appear here."
              note={ACTIVITY_BACKEND_NOTE}
            />
          ) : (
            <>
              <ul className="divide-y divide-[color:var(--border)]">
                {activity.map((item) => {
                  const palette = activityToneStyles[item.tone] ?? activityToneStyles.neutral;
                  return (
                    <li
                      key={item.id}
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[color:var(--card-2)]"
                    >
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: palette.bg, color: palette.fg }}
                      >
                        <Icon name={item.icon} size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-medium text-[color:var(--foreground)]">
                          {item.title}
                        </p>
                        {item.detail ? (
                          <p className="mt-0.5 truncate text-xs text-[color:var(--text-muted)]">{item.detail}</p>
                        ) : null}
                      </div>
                      <time
                        dateTime={item.timestamp}
                        title={new Date(item.time).toLocaleString()}
                        className="shrink-0 text-xs tabular-nums text-[color:var(--text-subtle)]"
                      >
                        {formatRelativeTime(item.time)}
                      </time>
                    </li>
                  );
                })}
              </ul>
              <p className="border-t border-[color:var(--border)] px-5 py-3 text-xs leading-relaxed text-[color:var(--text-subtle)]">
                {ACTIVITY_BACKEND_NOTE}
              </p>
            </>
          )}
        </SectionCard>

        {/* -------------------------------------------------- Quick actions */}
        <div className="space-y-5">
          <SectionCard title="Quick Actions" description="Jump straight into common tasks" icon="bolt" flush>
            <div className="flex flex-col p-2">
              {quickActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={action.onClick}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[color:var(--accent)]"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors"
                    style={
                      action.primary
                        ? { background: "var(--accent)", color: "#fff" }
                        : { background: "var(--muted)", color: "var(--text-muted)" }
                    }
                  >
                    <Icon name={action.icon} size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-medium text-[color:var(--foreground)]">
                      {action.label}
                    </span>
                    <span className="block truncate text-xs text-[color:var(--text-muted)]">{action.description}</span>
                  </span>
                  <span className="shrink-0 text-[color:var(--text-subtle)] transition-transform group-hover:translate-x-0.5">
                    <Icon name="chevronRight" size={14} />
                  </span>
                </button>
              ))}
            </div>
          </SectionCard>

          {!isPlatformAdmin ? (
            <SectionCard title="Entitlement" description="Your current access source" icon="shield">
              <dl className="space-y-2.5 text-[0.8125rem]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[color:var(--text-muted)]">Source</dt>
                  <dd>
                    <span className="ha-badge ha-badge-neutral">{props.entitlement?.source ?? "none"}</span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[color:var(--text-muted)]">Provider status</dt>
                  <dd>
                    <span
                      className={`ha-badge ${
                        props.entitlement?.providerStatus === "active" ? "ha-badge-success" : "ha-badge-neutral"
                      }`}
                    >
                      {props.entitlement?.providerStatus ?? "n/a"}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[color:var(--text-muted)]">Access</dt>
                  <dd>
                    <span
                      className={`ha-badge ${props.entitlement?.hasAccess ? "ha-badge-success" : "ha-badge-danger"}`}
                    >
                      {props.entitlement?.hasAccess ? "Granted" : "None"}
                    </span>
                  </dd>
                </div>
              </dl>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
