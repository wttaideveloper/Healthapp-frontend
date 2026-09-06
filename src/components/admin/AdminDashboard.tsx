"use client";

import { FormEvent, useCallback, useRef, useState } from "react";

import { AnalyticsView } from "@/components/admin/analytics/AnalyticsView";
import { AdminSidebar, type NavItem } from "@/components/admin/AdminSidebar";
import { AuditLogsView } from "@/components/admin/AuditLogsView";
import { DashboardOverview } from "@/components/admin/DashboardOverview";
import { MembersView } from "@/components/admin/MembersView";
import { UsersView } from "@/components/admin/UsersView";
import { WorkspacesView } from "@/components/admin/WorkspacesView";
import { Icon } from "@/components/ui/Icon";
import { ToastMessage } from "@/components/ui/ToastMessage";
import { useDialogBehavior } from "@/hooks/useDialogBehavior";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
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
  /** Resolves the new workspace's id, or null when creation failed. */
  onCreateWorkspace: (event: FormEvent<HTMLFormElement>) => Promise<string | null>;
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
  /** Resolves true when the save landed, so the update dialog knows to close. */
  onUpdateWorkspace: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
  onRevokeWorkspace?: ((workspaceId: string) => Promise<void>) | null;
  onPermanentlyDeleteWorkspace?: ((workspaceId: string, confirmation: string) => Promise<void>) | null;
  memberEmail: string;
  setMemberEmail: (value: string) => void;
  memberRole: string;
  setMemberRole: (value: string) => void;
  onAddMember: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUpdateMember: (memberId: string, role: string, status: string) => Promise<void>;
  onRevokeMember: (memberId: string) => Promise<void>;
  onPermanentlyDeleteMember?: ((memberId: string, confirmation: string) => Promise<void>) | null;
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
  /** Optional: reuses `PATCH admin/users/:id` `{ status: "disabled" }`. Null disables the action. */
  onDeactivateUser?: ((userId: string) => Promise<void>) | null;
  /** Optional: `POST admin/users/:id/permanent-delete`. Null disables the action. */
  onPermanentlyDeleteUser?: ((userId: string, confirmation: string) => Promise<void>) | null;
};

/** Stable no-op so an omitted `onNotify` does not change identity each render. */
function noopNotify(): void {}

const platformNav: NavItem[] = [
  { key: "overview", label: "Overview", icon: "grid" },
  { key: "analytics", label: "Analytics", icon: "chart" },
  { key: "workspaces", label: "Workspaces", icon: "building" },
  { key: "members", label: "Members", icon: "users" },
  { key: "users", label: "Individual Users", icon: "shield" },
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
  // The sidebar entry stays "Users"; the page itself spells out which kind of
  // user lives here, because "Users" and "Members" are easy to confuse.
  users: {
    title: "Individual Users",
    description: "Manage people who have access through their individual HealthAge subscription.",
  },
  "my-workspaces": { title: "My Workspaces", description: "Workspaces where you hold an owner or admin seat" },
};

const subscriptionStatusOptions = ["active", "trialing", "past_due", "expired", "canceled"];
const workspaceStatusOptions = ["active", "suspended", "revoked"];

const SIDEBAR_STORAGE_KEY = "healthage.admin.sidebarCollapsed";

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function AdminDashboard(props: AdminDashboardProps) {
  const nav = props.isPlatformAdmin ? platformNav : workspaceNav;
  const copy = viewCopy[props.activeView] ?? viewCopy.overview;
  const showOverview = props.activeView === "overview" || props.activeView === "my-workspaces";

  const [isMobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCollapsed, setCollapsed] = useLocalStorageState<boolean>(SIDEBAR_STORAGE_KEY, false, isBoolean);
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useDialogBehavior({
    open: isMobileNavOpen,
    onClose: () => setMobileNavOpen(false),
    panelRef: mobileNavRef,
  });

  /** Navigating from the overlay should also dismiss it. */
  const handleNavigate = useCallback(
    (view: ViewMode) => {
      props.setActiveView(view);
      setMobileNavOpen(false);
    },
    [props.setActiveView],
  );

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      {props.toast ? (
        <ToastMessage
          type={props.toast.type}
          message={props.toast.message}
          description={props.toast.description}
        />
      ) : null}

      {/* =========================================================== SIDEBAR */}
      {/* Desktop rail: fixed, so the main column scrolls independently. */}
      <aside
        aria-label="Primary"
        data-collapsed={isCollapsed}
        className="ha-shell-sidebar fixed inset-y-0 left-0 z-30 hidden border-r border-[color:var(--border)] lg:block"
      >
        <AdminSidebar
          nav={nav}
          activeView={props.activeView}
          onNavigate={handleNavigate}
          currentUser={props.currentUser}
          isPlatformAdmin={props.isPlatformAdmin}
          onSignOut={props.clearSession}
          collapsed={isCollapsed}
          onToggleCollapse={() => setCollapsed(!isCollapsed)}
        />
      </aside>

      {/* Mobile overlay: a modal surface with the same dialog contract as the
          detail drawers — Escape closes, focus is trapped, scroll is locked. */}
      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            aria-hidden="true"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-[color:var(--overlay)] backdrop-blur-[3px]"
            style={{ animation: "ha-fade-in var(--duration) var(--ease)" }}
          />
          <div
            ref={mobileNavRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="relative h-full w-[17rem] max-w-[85vw] border-r border-[color:var(--border)] shadow-[var(--shadow-xl)]"
            style={{ animation: "ha-slide-in-left var(--duration-slow) var(--ease-out)" }}
          >
            <AdminSidebar
              nav={nav}
              activeView={props.activeView}
              onNavigate={handleNavigate}
              currentUser={props.currentUser}
              isPlatformAdmin={props.isPlatformAdmin}
              onSignOut={props.clearSession}
              headerAction={
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation menu"
                  className="ha-btn ha-btn-ghost ha-btn-icon ha-btn-sm shrink-0"
                >
                  <Icon name="x" size={15} />
                </button>
              }
            />
          </div>
        </div>
      ) : null}

      {/* ============================================================== MAIN */}
      <div className="ha-shell-main flex min-h-screen flex-col" data-collapsed={isCollapsed}>
        <main className="min-w-0 flex-1">
          {/* --------------------------------------------------- Page header */}
          <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--card)]/80 backdrop-blur-xl">
            <div className="mx-auto flex h-[var(--header-height)] w-full max-w-[var(--content-max)] items-center gap-3 px-4 md:px-6 xl:px-8">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={isMobileNavOpen}
                className="ha-btn ha-btn-ghost ha-btn-icon -ml-1 shrink-0 lg:hidden"
              >
                <Icon name="menu" size={18} />
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="ha-page-title truncate">{copy.title}</h1>
                <p className="hidden truncate text-[0.8125rem] leading-tight text-[color:var(--text-muted)] sm:block">
                  {copy.description}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  aria-live="polite"
                  className="hidden text-xs tabular-nums text-[color:var(--text-subtle)] md:inline"
                >
                  {props.isLoadingDashboard
                    ? "Refreshing…"
                    : props.lastRefreshedAt
                      ? `Updated ${new Date(props.lastRefreshedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : ""}
                </span>

                <button
                  type="button"
                  onClick={props.onRefreshData}
                  disabled={props.isLoadingDashboard}
                  className="ha-btn ha-btn-secondary px-2.5 sm:px-3"
                  aria-label="Refresh dashboard data"
                >
                  <Icon
                    name="refresh"
                    size={14}
                    className={props.isLoadingDashboard ? "animate-spin" : undefined}
                  />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
            </div>
          </header>

          <div
            key={props.activeView}
            className="ha-enter mx-auto w-full max-w-[var(--content-max)] space-y-5 px-4 py-5 md:px-6 md:py-6 xl:px-8"
          >
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
                onRevokeWorkspace={props.onRevokeWorkspace ?? null}
                onPermanentlyDeleteWorkspace={props.onPermanentlyDeleteWorkspace ?? null}
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
                onPermanentlyDeleteMember={props.isPlatformAdmin ? (props.onPermanentlyDeleteMember ?? null) : null}
              />
            ) : null}

            {/* ===================================================== USERS */}
            {props.activeView === "users" && props.isPlatformAdmin ? (
              <UsersView
                users={props.users}
                workspaces={props.workspaces}
                members={props.members}
                isLoadingDashboard={props.isLoadingDashboard}
                dashboardError={props.dashboardError ?? null}
                isBusy={props.isBusy}
                onRefreshData={props.onRefreshData}
                onNotify={props.onNotify ?? noopNotify}
                onGoToMembers={() => handleNavigate("members")}
                onPromoteUserToAdmin={props.onPromoteUserToAdmin ?? null}
                onDeactivateUser={props.onDeactivateUser ?? null}
                onPermanentlyDeleteUser={props.onPermanentlyDeleteUser ?? null}
                currentUserId={props.currentUser.id}
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
