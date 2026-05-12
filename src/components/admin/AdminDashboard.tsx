import { FormEvent } from "react";

import { MetricCard } from "@/components/ui/MetricCard";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ToastMessage } from "@/components/ui/ToastMessage";
import { formatDateTime } from "@/lib/format";
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
};

const platformNav: Array<{ key: ViewMode; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "workspaces", label: "Workspaces" },
  { key: "members", label: "Members" },
  { key: "users", label: "Users" },
];

const workspaceNav: Array<{ key: ViewMode; label: string }> = [
  { key: "my-workspaces", label: "My Workspaces" },
  { key: "members", label: "Members" },
];

export function AdminDashboard(props: AdminDashboardProps) {
  const nav = props.isPlatformAdmin ? platformNav : workspaceNav;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8">
      {props.toast ? <ToastMessage type={props.toast.type} message={props.toast.message} /> : null}

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="rounded-3xl border border-border bg-card p-4 shadow-sm md:sticky md:top-6 md:h-[calc(100vh-3rem)]">
          <div className="mb-4 rounded-2xl bg-muted p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-accent">HealthAge</p>
            <p className="mt-1 text-sm font-semibold">{props.currentUser.name}</p>
            <p className="text-xs text-foreground/70">{props.currentUser.email}</p>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
            {nav.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => props.setActiveView(item.key)}
                className={`shrink-0 rounded-xl px-3 py-2 text-left text-sm transition ${
                  props.activeView === item.key ? "bg-foreground text-white" : "border border-border bg-white hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={props.clearSession}
            className="mt-4 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            Logout
          </button>
        </aside>

        <section className="space-y-6">
          <header className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-accent">Access Dashboard</p>
                <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{props.activeView.replace("-", " ")}</h1>
              </div>
              <button
                type="button"
                onClick={props.onRefreshData}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Refresh
              </button>
            </div>
          </header>

          {(props.activeView === "overview" || props.activeView === "my-workspaces") && (
            <section className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total Workspaces" value={props.metrics.totalWorkspaces} />
                <MetricCard label="Active Workspaces" value={props.metrics.activeWorkspaces} />
                <MetricCard label="Active Seats" value={props.metrics.totalActiveSeats} />
                <MetricCard label="Users With Access" value={props.metrics.usersWithAccess} />
              </div>
              {!props.isPlatformAdmin ? (
                <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                  <h2 className="text-lg font-semibold">Entitlement</h2>
                  <p className="mt-2 text-sm text-foreground/70">
                    Source: {props.entitlement?.source ?? "none"} | Provider status: {props.entitlement?.providerStatus ?? "n/a"}
                  </p>
                </article>
              ) : null}
            </section>
          )}

          {props.activeView === "workspaces" && props.isPlatformAdmin ? (
            <section className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <form className="rounded-3xl border border-border bg-card p-5 shadow-sm" onSubmit={props.onCreateWorkspace}>
                  <h2 className="text-lg font-semibold">Create Workspace</h2>
                  <div className="mt-4 grid gap-3">
                    <input value={props.workspaceName} onChange={(e) => props.setWorkspaceName(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Name" required />
                    <input value={props.workspaceOwnerEmail} onChange={(e) => props.setWorkspaceOwnerEmail(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Owner email" type="email" required />
                    <input value={props.workspaceSeatLimit} onChange={(e) => props.setWorkspaceSeatLimit(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Seat limit" type="number" min={1} />
                    <input value={props.workspacePlan} onChange={(e) => props.setWorkspacePlan(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Plan" />
                    <select value={props.workspaceSubscriptionStatus} onChange={(e) => props.setWorkspaceSubscriptionStatus(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
                      <option value="active">active</option><option value="trialing">trialing</option><option value="past_due">past_due</option><option value="expired">expired</option><option value="canceled">canceled</option>
                    </select>
                    <select value={props.workspaceStatus} onChange={(e) => props.setWorkspaceStatus(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
                      <option value="active">active</option><option value="suspended">suspended</option><option value="revoked">revoked</option>
                    </select>
                    <input value={props.workspaceExpiresAt} onChange={(e) => props.setWorkspaceExpiresAt(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="ExpiresAt ISO (optional)" />
                    <input value={props.workspaceNotes} onChange={(e) => props.setWorkspaceNotes(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Notes (optional)" />
                    <button type="submit" disabled={props.isBusy} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Create Workspace</button>
                  </div>
                </form>

                <form className="rounded-3xl border border-border bg-card p-5 shadow-sm" onSubmit={props.onUpdateWorkspace}>
                  <h2 className="text-lg font-semibold">Update Selected Workspace</h2>
                  <div className="mt-4 grid gap-3">
                    <select value={props.selectedWorkspaceId} onChange={(e) => void props.onWorkspaceSelectionChange(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
                      <option value="">Select workspace</option>
                      {props.workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                    </select>
                    <input value={props.updateOwnerEmail} onChange={(e) => props.setUpdateOwnerEmail(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Owner email" type="email" />
                    <input value={props.updateSeatLimit} onChange={(e) => props.setUpdateSeatLimit(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Seat limit" type="number" min={1} />
                    <input value={props.updatePlan} onChange={(e) => props.setUpdatePlan(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Plan" />
                    <select value={props.updateSubscriptionStatus} onChange={(e) => props.setUpdateSubscriptionStatus(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
                      <option value="active">active</option><option value="trialing">trialing</option><option value="past_due">past_due</option><option value="expired">expired</option><option value="canceled">canceled</option>
                    </select>
                    <select value={props.updateStatus} onChange={(e) => props.setUpdateStatus(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
                      <option value="active">active</option><option value="suspended">suspended</option><option value="revoked">revoked</option>
                    </select>
                    <input value={props.updateExpiresAt} onChange={(e) => props.setUpdateExpiresAt(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="ExpiresAt ISO" />
                    <input value={props.updateNotes} onChange={(e) => props.setUpdateNotes(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Notes" />
                    <button type="submit" disabled={!props.selectedWorkspaceId || props.isBusy} className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Update Workspace</button>
                  </div>
                </form>
              </div>

              <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Workspace Directory</h2>
                <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border md:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted text-left text-xs uppercase tracking-wider text-foreground/70"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Sub Status</th><th className="px-3 py-2">Seats</th></tr></thead>
                    <tbody>
                      {props.workspaces.map((workspace) => (
                        <tr key={workspace.id} className={`cursor-pointer border-t ${workspace.id === props.selectedWorkspaceId ? "bg-accent/10" : "bg-white/80 hover:bg-muted/60"}`} onClick={() => void props.onWorkspaceSelectionChange(workspace.id)}>
                          <td className="px-3 py-2">{workspace.name}</td><td className="px-3 py-2">{workspace.ownerEmail}</td><td className="px-3 py-2">{workspace.status}</td><td className="px-3 py-2">{workspace.subscriptionStatus}</td><td className="px-3 py-2">{workspace.activeSeatCount}/{workspace.seatLimit ?? "unlimited"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          ) : null}

          {props.activeView === "members" || props.activeView === "my-workspaces" ? (
            <section className="space-y-6">
              {!props.isPlatformAdmin ? (
                <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                  <h2 className="text-lg font-semibold">My Workspaces</h2>
                  <div className="mt-4 grid gap-3">
                    {props.myWorkspaces.map((workspace) => (
                      <button key={workspace.id} type="button" onClick={() => void props.onWorkspaceSelectionChange(workspace.id)} className={`rounded-xl border p-3 text-left ${props.selectedWorkspaceId === workspace.id ? "border-accent bg-accent/5" : "border-border bg-white"}`}>
                        <p className="text-sm font-semibold">{workspace.name}</p>
                        <p className="text-xs text-foreground/70">{workspace.role} • {workspace.status}</p>
                      </button>
                    ))}
                  </div>
                </article>
              ) : null}

              {!props.isPlatformAdmin ? (
                <form className="rounded-3xl border border-border bg-card p-5 shadow-sm" onSubmit={props.onAddMember}>
                  <h2 className="text-lg font-semibold">Add Member</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <input value={props.memberEmail} onChange={(e) => props.setMemberEmail(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="member@clinic.com" type="email" required />
                    <select value={props.memberRole} onChange={(e) => props.setMemberRole(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                    </select>
                    <button type="submit" disabled={!props.selectedWorkspaceId || props.isBusy} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Add</button>
                  </div>
                </form>
              ) : (
                <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                  <h2 className="text-lg font-semibold">Selected Workspace Members</h2>
                  <p className="mt-2 text-sm text-foreground/70">
                    Select a workspace in the Workspaces view to inspect its members here.
                  </p>
                </article>
              )}

              <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Workspace Members</h2>
                <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border md:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted text-left text-xs uppercase tracking-wider text-foreground/70"><tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2">Actions</th></tr></thead>
                    <tbody>
                      {props.members.map((member) => (
                        <tr key={member.id} className="border-t bg-white/80">
                          <td className="px-3 py-2">{member.email}</td>
                          <td className="px-3 py-2">{member.role}</td>
                          <td className="px-3 py-2">{member.status}</td>
                          <td className="px-3 py-2">{member.joinedAt ? formatDateTime(member.joinedAt) : "-"}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <button type="button" disabled={member.role === "owner" || props.isBusy} onClick={() => void props.onUpdateMember(member.id, member.role === "member" ? "admin" : "member", "active")} className="rounded-lg border border-border bg-white px-2 py-1 text-xs hover:bg-muted disabled:opacity-50">
                                Toggle Role
                              </button>
                              <button type="button" disabled={member.role === "owner" || props.isBusy} onClick={() => void props.onRevokeMember(member.id)} className="rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20 disabled:opacity-50">
                                Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          ) : null}

          {props.activeView === "users" && props.isPlatformAdmin ? (
            <section className="space-y-6">
              <form className="rounded-3xl border border-border bg-card p-5 shadow-sm" onSubmit={props.onCreateAdmin}>
                <h2 className="text-lg font-semibold">Create Admin User</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <input value={props.newAdminName} onChange={(e) => props.setNewAdminName(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Admin name" required />
                  <input value={props.newAdminEmail} onChange={(e) => props.setNewAdminEmail(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Admin email" type="email" required />
                  <PasswordInput value={props.newAdminPassword} onChange={(e) => props.setNewAdminPassword(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm" placeholder="Password" required />
                  <button type="submit" disabled={props.isBusy} className="rounded-xl bg-accent-2 px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60">Create Admin</button>
                </div>
              </form>

              <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Users Directory</h2>
                <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border md:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted text-left text-xs uppercase tracking-wider text-foreground/70"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Access</th><th className="px-3 py-2">Created</th></tr></thead>
                    <tbody>{props.users.map((user) => <tr key={user.id} className="border-t bg-white/80"><td className="px-3 py-2">{user.name}</td><td className="px-3 py-2">{user.email}</td><td className="px-3 py-2">{user.role}</td><td className="px-3 py-2">{user.status}</td><td className="px-3 py-2">{user.hasAccess ? "yes" : "no"}</td><td className="px-3 py-2">{formatDateTime(user.createdAt)}</td></tr>)}</tbody>
                  </table>
                </div>
              </article>
            </section>
          ) : null}

          {props.isLoadingDashboard ? <p className="text-sm text-foreground/70">Loading dashboard...</p> : null}
        </section>
      </div>
    </main>
  );
}
