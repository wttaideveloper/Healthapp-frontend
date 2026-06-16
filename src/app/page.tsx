"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { callApi } from "@/lib/admin/api";
import { isDevelopmentEnvironment } from "@/lib/admin/environment";
import { tokenStorageKey, userStorageKey } from "@/lib/admin/storage";
import {
  AdminUser,
  AuthUser,
  DashboardMetrics,
  EntitlementResponse,
  LoginResponse,
  ToastState,
  ToastType,
  ViewMode,
  Workspace,
  WorkspaceMember,
  WorkspaceMembership,
} from "@/types/admin";

type AdminWorkspaceDetailsResponse = Workspace & {
  members: WorkspaceMember[];
};

function isPlatformAdmin(user: AuthUser | null): boolean {
  return user?.role === "admin";
}

function isWorkspaceManager(entitlement: EntitlementResponse | null): boolean {
  return entitlement?.workspace?.role === "owner" || entitlement?.workspace?.role === "admin";
}

export default function Home() {
  const namePattern = /^[A-Za-z][A-Za-z0-9 ]*$/;
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementResponse | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>("overview");

  const [loginEmail, setLoginEmail] = useState("admin@conference.org");
  const [loginPassword, setLoginPassword] = useState("Password123!");
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  const [bootstrapToken, setBootstrapToken] = useState("");
  const [bootstrapName, setBootstrapName] = useState("Platform Admin");
  const [bootstrapEmail, setBootstrapEmail] = useState("admin@conference.org");
  const [bootstrapPassword, setBootstrapPassword] = useState("Password123!");
  const [promoteEmail, setPromoteEmail] = useState("admin@conference.org");

  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceOwnerEmail, setWorkspaceOwnerEmail] = useState("");
  const [workspaceSeatLimit, setWorkspaceSeatLimit] = useState("");
  const [workspacePlan, setWorkspacePlan] = useState("organization");
  const [workspaceSubscriptionStatus, setWorkspaceSubscriptionStatus] = useState("active");
  const [workspaceStatus, setWorkspaceStatus] = useState("active");
  const [workspaceNotes, setWorkspaceNotes] = useState("");
  const [workspaceExpiresAt, setWorkspaceExpiresAt] = useState("");

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [updateOwnerEmail, setUpdateOwnerEmail] = useState("");
  const [updateSeatLimit, setUpdateSeatLimit] = useState("");
  const [updatePlan, setUpdatePlan] = useState("organization");
  const [updateSubscriptionStatus, setUpdateSubscriptionStatus] = useState("active");
  const [updateStatus, setUpdateStatus] = useState("active");
  const [updateNotes, setUpdateNotes] = useState("");
  const [updateExpiresAt, setUpdateExpiresAt] = useState("");

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("member");

  const [newAdminName, setNewAdminName] = useState("Regional Admin");
  const [newAdminEmail, setNewAdminEmail] = useState("regional.admin@conference.org");
  const [newAdminPassword, setNewAdminPassword] = useState("Password123!");

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [myWorkspaces, setMyWorkspaces] = useState<WorkspaceMembership[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);

  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showDevAdminBootstrapTools = isDevelopmentEnvironment();
  const platformAdmin = isPlatformAdmin(currentUser);
  const workspaceManager = isWorkspaceManager(entitlement);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );

  const metrics: DashboardMetrics = useMemo(() => {
    const sourceRows = platformAdmin
      ? workspaces
      : myWorkspaces.map((item) => ({
        id: item.id,
        name: item.name,
        ownerUserId: null,
        ownerEmail: "",
        status: item.status,
        subscriptionStatus: item.subscriptionStatus,
        plan: item.plan,
        seatLimit: item.seatLimit,
        activeSeatCount: item.activeSeatCount,
        expiresAt: item.expiresAt,
        notes: null,
        createdByUserId: null,
        revokedAt: null,
        createdAt: "",
        updatedAt: "",
      }));

    return {
      totalWorkspaces: sourceRows.length,
      activeWorkspaces: sourceRows.filter((workspace) => workspace.status === "active").length,
      totalActiveSeats: sourceRows.reduce((sum, workspace) => sum + workspace.activeSeatCount, 0),
      usersWithAccess: users.filter((user) => user.hasAccess).length,
    };
  }, [platformAdmin, workspaces, myWorkspaces, users]);

  function showToast(type: ToastType, message: string): void {
    const nextToast = { id: Date.now(), type, message };
    setToast(nextToast);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast((existing) => (existing?.id === nextToast.id ? null : existing));
    }, 3200);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(tokenStorageKey);
    const savedUser = window.localStorage.getItem(userStorageKey);
    if (savedToken) setToken(savedToken);
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser) as AuthUser);
      } catch {
        window.localStorage.removeItem(userStorageKey);
      }
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadDashboard(token, currentUser);
  }, [token, currentUser?.id]);

  async function loadDashboard(authToken: string, user: AuthUser | null): Promise<void> {
    setIsLoadingDashboard(true);
    try {
      const entitlementResponse = await callApi<EntitlementResponse>("entitlements/me", { method: "GET" }, authToken);
      setEntitlement(entitlementResponse);

      if (isPlatformAdmin(user)) {
        const [workspaceRows, userRows] = await Promise.all([
          callApi<Workspace[]>("admin/workspaces", { method: "GET" }, authToken),
          callApi<AdminUser[]>("admin/users", { method: "GET" }, authToken),
        ]);
        setWorkspaces(workspaceRows);
        setUsers(userRows);

        if (workspaceRows.length > 0) {
          const nextSelected = selectedWorkspaceId || workspaceRows[0].id;
          setSelectedWorkspaceId(nextSelected);
          await loadMembers(authToken, nextSelected, true);
        } else {
          setSelectedWorkspaceId("");
          setMembers([]);
        }
        return;
      }

      const workspaceRows = await callApi<WorkspaceMembership[]>("workspaces/me", { method: "GET" }, authToken);
      setMyWorkspaces(workspaceRows);
      setUsers([]);
      if (workspaceRows.length > 0) {
        const workspaceId = workspaceRows[0].id;
        setSelectedWorkspaceId(workspaceId);
        await loadMembers(authToken, workspaceId, false);
      } else {
        setSelectedWorkspaceId("");
        setMembers([]);
      }
      setActiveView("my-workspaces");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to load dashboard");
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function loadMembers(authToken: string, workspaceId: string, adminContext: boolean): Promise<void> {
    if (!workspaceId) {
      setMembers([]);
      return;
    }

    try {
      if (adminContext) {
        const workspaceDetails = await callApi<AdminWorkspaceDetailsResponse>(`admin/workspaces/${workspaceId}`, { method: "GET" }, authToken);
        setMembers(workspaceDetails.members ?? []);
      } else {
        const rows = await callApi<WorkspaceMember[]>(`workspaces/${workspaceId}/members`, { method: "GET" }, authToken);
        setMembers(rows);
      }
    } catch (error) {
      setMembers([]);
      const message = error instanceof Error ? error.message : "Failed to load workspace members";
      if (message.includes("not found")) {
        showToast("error", "Workspace not found or members route is unavailable.");
      } else {
        showToast("error", message);
      }
    }
  }

  function saveSession(accessToken: string, user: AuthUser): void {
    setToken(accessToken);
    setCurrentUser(user);
    window.localStorage.setItem(tokenStorageKey, accessToken);
    window.localStorage.setItem(userStorageKey, JSON.stringify(user));
  }

  function clearSession(): void {
    setToken(null);
    setCurrentUser(null);
    setEntitlement(null);
    setWorkspaces([]);
    setMyWorkspaces([]);
    setUsers([]);
    setMembers([]);
    setSelectedWorkspaceId("");
    window.localStorage.removeItem(tokenStorageKey);
    window.localStorage.removeItem(userStorageKey);
  }

  async function onLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsBusy(true);
    try {
      const data = await callApi<LoginResponse>("auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      // Verify entitlements: only platform admins or workspace admins (owner/admin) may sign in
      let entitlementResponse = null;
      try {
        entitlementResponse = await callApi<EntitlementResponse>("entitlements/me", { method: "GET" }, data.accessToken);
      } catch (e) {
        // treat failure to fetch entitlements as no entitlement
        entitlementResponse = null;
      }

      const platformAdmin = data.user.role === "admin";
      const workspaceAdmin = !!(
        entitlementResponse &&
        entitlementResponse.workspace &&
        (entitlementResponse.workspace.role === "owner" || entitlementResponse.workspace.role === "admin") &&
        entitlementResponse.workspace.memberStatus === "active"
      );

      if (!platformAdmin && !workspaceAdmin) {
        showToast("error", "Account not authorized. A platform admin must add you as a workspace admin before signing in.");
        setIsBusy(false);
        return;
      }

      saveSession(data.accessToken, data.user);
      setActiveView(data.user.role === "admin" ? "overview" : "my-workspaces");
      showToast("success", "Signed in successfully.");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function onResetPassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsBusy(true);
    try {
      if (!/^\d{6}$/.test(resetOtp)) {
        throw new Error("OTP must be exactly 6 digits.");
      }
      if (resetNewPassword.length < 8 || resetNewPassword.length > 128) {
        throw new Error("Password must be 8 to 128 characters.");
      }

      const response = await callApi<{ ok: boolean; message: string }>("auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: resetEmail,
          otp: resetOtp,
          newPassword: resetNewPassword,
        }),
      });
      showToast("success", response.message || "Password updated successfully.");
      setResetOtp("");
      setResetNewPassword("");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to reset password");
    } finally {
      setIsBusy(false);
    }
  }

  async function onBootstrapAdmin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!showDevAdminBootstrapTools) {
      showToast("error", "First admin bootstrap is only available in development.");
      return;
    }
    setIsBusy(true);
    try {
      await callApi("admin/users/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bootstrap-token": bootstrapToken,
        },
        body: JSON.stringify({ name: bootstrapName, email: bootstrapEmail, password: bootstrapPassword }),
      });
      showToast("success", "Initial admin created.");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to create first admin");
    } finally {
      setIsBusy(false);
    }
  }

  async function onPromoteAdmin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!showDevAdminBootstrapTools) {
      showToast("error", "Promote-to-admin is only available in development.");
      return;
    }
    setIsBusy(true);
    try {
      await callApi("admin/users/promote-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bootstrap-token": bootstrapToken,
        },
        body: JSON.stringify({ email: promoteEmail }),
      });
      showToast("success", "User promoted to admin.");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to promote user");
    } finally {
      setIsBusy(false);
    }
  }

  async function onCreateWorkspace(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) return;
    setIsBusy(true);
    try {
      await callApi(
        "admin/workspaces",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: workspaceName,
            ownerEmail: workspaceOwnerEmail,
            seatLimit: workspaceSeatLimit ? Number(workspaceSeatLimit) : null,
            plan: workspacePlan,
            expiresAt: workspaceExpiresAt || null,
            subscriptionStatus: workspaceSubscriptionStatus,
            status: workspaceStatus,
            notes: workspaceNotes || null,
          }),
        },
        token,
      );
      showToast("success", "Workspace created.");
      await loadDashboard(token, currentUser);
      setActiveView("workspaces");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to create workspace");
    } finally {
      setIsBusy(false);
    }
  }

  async function onUpdateWorkspace(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !selectedWorkspaceId) return;
    setIsBusy(true);
    try {
      await callApi(
        `admin/workspaces/${selectedWorkspaceId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerEmail: updateOwnerEmail || undefined,
            seatLimit: updateSeatLimit ? Number(updateSeatLimit) : undefined,
            plan: updatePlan || undefined,
            expiresAt: updateExpiresAt || undefined,
            subscriptionStatus: updateSubscriptionStatus || undefined,
            status: updateStatus || undefined,
            notes: updateNotes || undefined,
          }),
        },
        token,
      );
      showToast("success", "Workspace updated.");
      await loadDashboard(token, currentUser);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to update workspace");
    } finally {
      setIsBusy(false);
    }
  }

  async function onWorkspaceSelectionChange(workspaceId: string): Promise<void> {
    setSelectedWorkspaceId(workspaceId);
    if (!token) return;
    await loadMembers(token, workspaceId, platformAdmin);
  }

  async function onAddMember(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !selectedWorkspaceId) return;
    setIsBusy(true);
    try {
      const route = platformAdmin ? `admin/workspaces/${selectedWorkspaceId}/members` : `workspaces/${selectedWorkspaceId}/members`;
      await callApi(
        route,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: memberEmail, role: memberRole }),
        },
        token,
      );
      setMemberEmail("");
      showToast("success", "Member added.");
      await loadMembers(token, selectedWorkspaceId, platformAdmin);
      await loadDashboard(token, currentUser);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to add member");
    } finally {
      setIsBusy(false);
    }
  }

  async function onUpdateMember(memberId: string, role: string, status: string): Promise<void> {
    if (!token || !selectedWorkspaceId) return;
    setIsBusy(true);
    try {
      const route = platformAdmin
        ? `admin/workspaces/${selectedWorkspaceId}/members/${memberId}`
        : `workspaces/${selectedWorkspaceId}/members/${memberId}`;
      await callApi(
        route,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, status }),
        },
        token,
      );
      showToast("success", "Member updated.");
      await loadMembers(token, selectedWorkspaceId, platformAdmin);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to update member");
    } finally {
      setIsBusy(false);
    }
  }

  async function onRevokeMember(memberId: string): Promise<void> {
    if (!token || !selectedWorkspaceId) return;
    setIsBusy(true);
    try {
      const route = platformAdmin
        ? `admin/workspaces/${selectedWorkspaceId}/members/${memberId}`
        : `workspaces/${selectedWorkspaceId}/members/${memberId}`;
      await callApi(route, { method: "DELETE" }, token);
      showToast("success", "Member revoked.");
      await loadMembers(token, selectedWorkspaceId, platformAdmin);
      await loadDashboard(token, currentUser);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to revoke member");
    } finally {
      setIsBusy(false);
    }
  }

  async function onCreateAdmin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) return;
    setIsBusy(true);
    try {
      const normalizedName = newAdminName.trim();
      if (!namePattern.test(normalizedName)) {
        throw new Error("Name must start with a letter and can include letters, numbers, and spaces.");
      }

      await callApi(
        "admin/users/admin",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: normalizedName,
            email: newAdminEmail,
            password: newAdminPassword,
          }),
        },
        token,
      );
      showToast("success", "Admin created.");
      await loadDashboard(token, currentUser);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to create admin");
    } finally {
      setIsBusy(false);
    }
  }

  if (!token || !currentUser) {
    return (
      <AdminAuthScreen
        toast={toast}
        isBusy={isBusy}
        loginEmail={loginEmail}
        setLoginEmail={setLoginEmail}
        loginPassword={loginPassword}
        setLoginPassword={setLoginPassword}
        onLogin={onLogin}
      />
    );
  }

  return (
    <AdminDashboard
      toast={toast}
      currentUser={currentUser}
      entitlement={entitlement}
      activeView={activeView}
      setActiveView={setActiveView}
      isPlatformAdmin={platformAdmin}
      onRefreshData={() => {
        if (token) void loadDashboard(token, currentUser);
      }}
      clearSession={clearSession}
      isLoadingDashboard={isLoadingDashboard}
      isBusy={isBusy}
      metrics={metrics}
      workspaces={workspaces}
      myWorkspaces={myWorkspaces}
      users={users}
      members={members}
      selectedWorkspaceId={selectedWorkspaceId}
      selectedWorkspace={selectedWorkspace}
      onWorkspaceSelectionChange={onWorkspaceSelectionChange}
      workspaceName={workspaceName}
      setWorkspaceName={setWorkspaceName}
      workspaceOwnerEmail={workspaceOwnerEmail}
      setWorkspaceOwnerEmail={setWorkspaceOwnerEmail}
      workspaceSeatLimit={workspaceSeatLimit}
      setWorkspaceSeatLimit={setWorkspaceSeatLimit}
      workspacePlan={workspacePlan}
      setWorkspacePlan={setWorkspacePlan}
      workspaceSubscriptionStatus={workspaceSubscriptionStatus}
      setWorkspaceSubscriptionStatus={setWorkspaceSubscriptionStatus}
      workspaceStatus={workspaceStatus}
      setWorkspaceStatus={setWorkspaceStatus}
      workspaceNotes={workspaceNotes}
      setWorkspaceNotes={setWorkspaceNotes}
      workspaceExpiresAt={workspaceExpiresAt}
      setWorkspaceExpiresAt={setWorkspaceExpiresAt}
      onCreateWorkspace={onCreateWorkspace}
      updateOwnerEmail={updateOwnerEmail}
      setUpdateOwnerEmail={setUpdateOwnerEmail}
      updateSeatLimit={updateSeatLimit}
      setUpdateSeatLimit={setUpdateSeatLimit}
      updatePlan={updatePlan}
      setUpdatePlan={setUpdatePlan}
      updateSubscriptionStatus={updateSubscriptionStatus}
      setUpdateSubscriptionStatus={setUpdateSubscriptionStatus}
      updateStatus={updateStatus}
      setUpdateStatus={setUpdateStatus}
      updateNotes={updateNotes}
      setUpdateNotes={setUpdateNotes}
      updateExpiresAt={updateExpiresAt}
      setUpdateExpiresAt={setUpdateExpiresAt}
      onUpdateWorkspace={onUpdateWorkspace}
      memberEmail={memberEmail}
      setMemberEmail={setMemberEmail}
      memberRole={memberRole}
      setMemberRole={setMemberRole}
      onAddMember={onAddMember}
      onUpdateMember={onUpdateMember}
      onRevokeMember={onRevokeMember}
      newAdminName={newAdminName}
      setNewAdminName={setNewAdminName}
      newAdminEmail={newAdminEmail}
      setNewAdminEmail={setNewAdminEmail}
      newAdminPassword={newAdminPassword}
      setNewAdminPassword={setNewAdminPassword}
      onCreateAdmin={onCreateAdmin}
    />
  );
}
