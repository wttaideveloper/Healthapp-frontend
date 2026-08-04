import { FormEvent } from "react";

import { AnalyticsView } from "@/components/admin/analytics/AnalyticsView";
import { AuditLogsView } from "@/components/admin/AuditLogsView";
import { DashboardOverview } from "@/components/admin/DashboardOverview";
import { MembersView } from "@/components/admin/MembersView";
import { UsersView } from "@/components/admin/UsersView";
import { WorkspacesView } from "@/components/admin/WorkspacesView";
import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { ToastMessage } from "@/components/ui/ToastMessage";
import {
  AdminUser,
  AuthUser,
  DashboardMetrics,
  EntitlementResponse,
  ToastState,
  ViewMode,
  Workspace,
  WorkspaceMember,
  WorkspaceMembership,
} from "@/types/admin";

type AdminDashboardProps = {
  toast: ToastState;
  currentUser: AuthUser;
  entitlement: EntitlementResponse | null;
  activeView: ViewMode;
  setActiveView: (value: ViewMode) => void;
  isPlatformAdmin: boolean;
  onRefreshData: () => void;
  clearSession: () => void;
  isLoadingDashboard: boolean;
  isBusy: boolean;
  metrics: DashboardMetrics;
  workspaces: Workspace[];
  myWorkspaces: WorkspaceMembership[];
  users: AdminUser[];
  members: WorkspaceMember[];
  selectedWorkspaceId: string;
  selectedWorkspace: Workspace | null;
  onWorkspaceSelectionChange: (workspaceId: string) => Promise<void>;
  workspaceName: string;
  setWorkspaceName: (value: string) => void;
  workspaceOwnerEmail: string;
  setWorkspaceOwnerEmail: (value: string) => void;
  workspaceSeatLimit: string;
  setWorkspaceSeatLimit: (value: string) => void;
  workspacePlan: string;
  setWorkspacePlan: (value: string) => void;
  workspaceSubscriptionStatus: string;
  setWorkspaceSubscriptionStatus: (value: string) => void;
  workspaceStatus: string;
  setWorkspaceStatus: (value: string) => void;
  workspaceNotes: string;
  setWorkspaceNotes: (value: string) => void;
  workspaceExpiresAt: string;
  setWorkspaceExpiresAt: (value: string) => void;
  onCreateWorkspace: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateOwnerEmail: string;
  setUpdateOwnerEmail: (value: string) => void;
  updateSeatLimit: string;
  setUpdateSeatLimit: (value: string) => void;
  updatePlan: string;
  setUpdatePlan: (value: string) => void;
  updateSubscriptionStatus: string;
  setUpdateSubscriptionStatus: (value: string) => void;
  updateStatus: string;
  setUpdateStatus: (value: string) => void;
  updateNotes: string;
  setUpdateNotes: (value: string) => void;
  updateExpiresAt: string;
  setUpdateExpiresAt: (value: string) => void;
  onUpdateWorkspace: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  memberEmail: string;
  setMemberEmail: (value: string) => void;
  memberRole: string;
  setMemberRole: (value: string) => void;
  onAddMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUpdateMember: (memberId: string, role: string, status: string) => Promise<void>;
  onRevokeMember: (memberId: string) => Promise<void>;
  newAdminName: string;
  setNewAdminName: (value: string) => void;
  newAdminEmail: string;
  setNewAdminEmail: (value: string) => void;
  newAdminPassword: string;
  setNewAdminPassword: (value: string) => void;
  onCreateAdmin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Optional: surfaces a load failure in the overview KPIs. */
  dashboardError?: string | null;
  /** Optional: ISO timestamp of the last completed dashboard load. */
  lastRefreshedAt?: string | null;
  /** Optional: raises a toast (used by copy-to-clipboard in the Users view). */
  onNotify?: (type: "success" | "error", message: string) => void;
  /** Optional: reuses `POST admin/users/promote-admin`. Null disables the action. */
  onPromoteUserToAdmin?: ((email: string) => Promise<void>) | null;
};

/** Stable no-op so an omitted `onNotify` does not change identity each render. */
function noopNotify(): void {}

type NavItem = { key: ViewMode; label: string; icon: IconName };

const platformNav: NavItem[] = [
  { key: "overview", label: "Overview", icon: "grid" },
  { key: "analytics", label: "Analytics", icon: "chart" },
  { key: "workspaces", label: "Workspaces", icon: "building" },
  { key: "members", label: "Members", icon: "users" },
  { key: "users", label: "Users", icon: "shield" },
  { key: "audit", label: "Audit Logs", icon: "history" },
];

const workspaceNav: NavItem[] = [
  { key: "my-workspaces", label: "My Workspaces", icon: "building" },
  { key: "analytics", label: "Analytics", icon: "chart" },
  { key: "members", label: "Members", icon: "users" },
];

const viewCopy: Record<ViewMode, { title: string; description: string }> = {
  overview: { title: "Overview", description: "Platform health across workspaces, subscriptions, and accounts" },
  analytics: { title: "Analytics", description: "Executive view of adoption, capacity, and subscription health" },
  audit: { title: "Audit Logs", description: "Who did what, when, and to which resource" },
  workspaces: { title: "Workspaces", description: "Provision and manage organization workspaces" },
  members: { title: "Members", description: "Manage seats and roles within a workspace" },
  users: { title: "Users", description: "Platform accounts and administrator management" },
  "my-workspaces": { title: "My Workspaces", description: "Workspaces where you hold an owner or admin seat" },
};

const subscriptionStatusOptions = ["active", "trialing", "past_due", "expired", "canceled"];
const workspaceStatusOptions = ["active", "suspended", "revoked"];

export function AdminDashboard(props: AdminDashboardProps) {
  const nav = props.isPlatformAdmin ? platformNav : workspaceNav;
  const copy = viewCopy[props.activeView] ?? viewCopy.overview;
  const showOverview = props.activeView === "overview" || props.activeView === "my-workspaces";

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      {props.toast ? <ToastMessage type={props.toast.type} message={props.toast.message} /> : null}

      <div className="mx-auto flex w-full max-w-[1400px] flex-col lg:flex-row">
        {/* ============================================================ SIDEBAR */}
        <aside className="shrink-0 border-b border-[color:var(--border)] bg-[color:var(--card)] lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col">
            {/* Brand */}
            <div className="flex items-center gap-2.5 px-5 py-4 lg:py-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--accent)] text-white">
                <Icon name="shield" size={17} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.8125rem] font-semibold leading-tight">HealthAge</p>
                <p className="truncate text-[0.6875rem] leading-tight text-[color:var(--text-muted)]">Admin Console</p>
              </div>
              <span
                className={`ml-auto ha-badge ${props.isPlatformAdmin ? "ha-badge-warning" : "ha-badge-info"} lg:hidden`}
              >
                {props.isPlatformAdmin ? "Platform" : "Workspace"}
              </span>
            </div>

            {/* Navigation */}
            <nav
              aria-label="Dashboard sections"
              className="ha-scroll flex gap-1.5 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0"
            >
              {nav.map((item) => {
                const isActive = props.activeView === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => props.setActiveView(item.key)}
                    className={`ha-nav-item shrink-0 ${isActive ? "ha-nav-item-active" : ""}`}
                  >
                    <Icon name={item.icon} size={15} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Account */}
            <div className="mt-auto hidden border-t border-[color:var(--border)] p-3 lg:block">
              <div className="flex items-center gap-2.5 rounded-lg bg-[color:var(--muted)] px-3 py-2.5">
                <Avatar name={props.currentUser.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium leading-tight">{props.currentUser.name}</p>
                  <p className="truncate text-[0.6875rem] leading-tight text-[color:var(--text-muted)]">
                    {props.currentUser.email}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 px-1">
                <span className={`ha-badge ${props.isPlatformAdmin ? "ha-badge-warning" : "ha-badge-info"}`}>
                  {props.isPlatformAdmin ? "Platform admin" : "Workspace admin"}
                </span>
                <button
                  type="button"
                  onClick={props.clearSession}
                  className="ha-btn ha-btn-ghost ha-btn-sm"
                  title="Sign out"
                >
                  <Icon name="logout" size={13} />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* ============================================================== MAIN */}
        <main className="min-w-0 flex-1">
          {/* Page header */}
          <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--card)]/85 px-5 py-4 backdrop-blur-md md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-[-0.01em] md:text-xl">{copy.title}</h1>
                <p className="mt-0.5 truncate text-[0.8125rem] text-[color:var(--text-muted)]">{copy.description}</p>
              </div>

              <div className="flex items-center gap-2">
                {props.lastRefreshedAt && !props.isLoadingDashboard ? (
                  <span className="hidden text-xs text-[color:var(--text-subtle)] sm:inline">
                    Updated {new Date(props.lastRefreshedAt).toLocaleTimeString()}
                  </span>
                ) : null}
                {props.isLoadingDashboard ? (
                  <span className="hidden text-xs text-[color:var(--text-subtle)] sm:inline">Loadingâ€¦</span>
                ) : null}
                <button
                  type="button"
                  onClick={props.onRefreshData}
                  disabled={props.isLoadingDashboard}
                  className="ha-btn ha-btn-secondary"
                >
                  <Icon
                    name="refresh"
                    size={14}
                    className={props.isLoadingDashboard ? "animate-spin" : undefined}
                  />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={props.clearSession}
                  className="ha-btn ha-btn-ghost lg:hidden"
                  title="Sign out"
                >
                  <Icon name="logout" size={14} />
                </button>
              </div>
            </div>
          </header>

          <div className="space-y-5 px-5 py-6 md:px-8">
            {/* ================================================== OVERVIEW */}
            {showOverview ? (
              <DashboardOverview
                metrics={props.metrics}
                isPlatformAdmin={props.isPlatformAdmin}
                isLoadingDashboard={props.isLoadingDashboard}
                dashboardError={props.dashboardError ?? null}
                entitlement={props.entitlement}
                workspaces={props.workspaces}
                users={props.users}
                members={props.members}
                onRefreshData={props.onRefreshData}
                setActiveView={props.setActiveView}
              />
            ) : null}

            {/* ================================================= ANALYTICS */}
            {props.activeView === "analytics" ? (
              <AnalyticsView
                isPlatformAdmin={props.isPlatformAdmin}
                workspaces={props.workspaces}
                myWorkspaces={props.myWorkspaces}
                users={props.users}
                members={props.members}
                membersScopeLabel={props.metrics.pendingInvitationsScope}
                isLoadingDashboard={props.isLoadingDashboard}
                dashboardError={props.dashboardError ?? null}
                onRefreshData={props.onRefreshData}
                onNotify={props.onNotify ?? noopNotify}
              />
            ) : null}

            {/* ===================================================== AUDIT */}
            {/* Platform-admin only: the read endpoint authorizes on the same role. */}
            {props.activeView === "audit" && props.isPlatformAdmin ? (
              <AuditLogsView onNotify={props.onNotify ?? noopNotify} />
            ) : null}

            {/* ================================================ WORKSPACES */}
            {props.activeView === "workspaces" && props.isPlatformAdmin ? (
              <WorkspacesView
                workspaces={props.workspaces}
                users={props.users}
                members={props.members}
                selectedWorkspaceId={props.selectedWorkspaceId}
                onWorkspaceSelectionChange={props.onWorkspaceSelectionChange}
                isLoadingDashboard={props.isLoadingDashboard}
                dashboardError={props.dashboardError ?? null}
                isBusy={props.isBusy}
                onRefreshData={props.onRefreshData}
                onNotify={props.onNotify ?? noopNotify}
                workspaceName={props.workspaceName}
                setWorkspaceName={props.setWorkspaceName}
                workspaceOwnerEmail={props.workspaceOwnerEmail}
                setWorkspaceOwnerEmail={props.setWorkspaceOwnerEmail}
                workspaceSeatLimit={props.workspaceSeatLimit}
                setWorkspaceSeatLimit={props.setWorkspaceSeatLimit}
                workspacePlan={props.workspacePlan}
                setWorkspacePlan={props.setWorkspacePlan}
                workspaceSubscriptionStatus={props.workspaceSubscriptionStatus}
                setWorkspaceSubscriptionStatus={props.setWorkspaceSubscriptionStatus}
                workspaceStatus={props.workspaceStatus}
                setWorkspaceStatus={props.setWorkspaceStatus}
                workspaceNotes={props.workspaceNotes}
                setWorkspaceNotes={props.setWorkspaceNotes}
                workspaceExpiresAt={props.workspaceExpiresAt}
                setWorkspaceExpiresAt={props.setWorkspaceExpiresAt}
                onCreateWorkspace={props.onCreateWorkspace}
                updateSeatLimit={props.updateSeatLimit}
                setUpdateSeatLimit={props.setUpdateSeatLimit}
                updatePlan={props.updatePlan}
                setUpdatePlan={props.setUpdatePlan}
                updateSubscriptionStatus={props.updateSubscriptionStatus}
                setUpdateSubscriptionStatus={props.setUpdateSubscriptionStatus}
                updateStatus={props.updateStatus}
                setUpdateStatus={props.setUpdateStatus}
                updateNotes={props.updateNotes}
                setUpdateNotes={props.setUpdateNotes}
                updateExpiresAt={props.updateExpiresAt}
                setUpdateExpiresAt={props.setUpdateExpiresAt}
                onUpdateWorkspace={props.onUpdateWorkspace}
                memberEmail={props.memberEmail}
                setMemberEmail={props.setMemberEmail}
                memberRole={props.memberRole}
                setMemberRole={props.setMemberRole}
                onAddMember={props.onAddMember}
              />
            ) : null}

            {/* =================================================== MEMBERS */}
            {props.activeView === "members" || props.activeView === "my-workspaces" ? (
              <MembersView
                members={props.members}
                users={props.users}
                workspaces={props.workspaces}
                myWorkspaces={props.myWorkspaces}
                selectedWorkspaceId={props.selectedWorkspaceId}
                selectedWorkspace={props.selectedWorkspace}
                onWorkspaceSelectionChange={props.onWorkspaceSelectionChange}
                isPlatformAdmin={props.isPlatformAdmin}
                isLoadingDashboard={props.isLoadingDashboard}
                dashboardError={props.dashboardError ?? null}
                isBusy={props.isBusy}
                onRefreshData={props.onRefreshData}
                onNotify={props.onNotify ?? noopNotify}
                memberEmail={props.memberEmail}
                setMemberEmail={props.setMemberEmail}
                memberRole={props.memberRole}
                setMemberRole={props.setMemberRole}
                onAddMember={props.onAddMember}
                onUpdateMember={props.onUpdateMember}
                onRevokeMember={props.onRevokeMember}
              />
            ) : null}

            {/* ===================================================== USERS */}
            {props.activeView === "users" && props.isPlatformAdmin ? (
              <UsersView
                users={props.users}
                workspaces={props.workspaces}
                isLoadingDashboard={props.isLoadingDashboard}
                dashboardError={props.dashboardError ?? null}
                isBusy={props.isBusy}
                onRefreshData={props.onRefreshData}
                onNotify={props.onNotify ?? noopNotify}
                onPromoteUserToAdmin={props.onPromoteUserToAdmin ?? null}
                newAdminName={props.newAdminName}
                setNewAdminName={props.setNewAdminName}
                newAdminEmail={props.newAdminEmail}
                setNewAdminEmail={props.setNewAdminEmail}
                newAdminPassword={props.newAdminPassword}
                setNewAdminPassword={props.setNewAdminPassword}
                onCreateAdmin={props.onCreateAdmin}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
