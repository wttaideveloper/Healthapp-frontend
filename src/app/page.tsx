"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { AdminAuthScreen } from "@/components/admin/AdminAuthScreen";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { callApi } from "@/lib/admin/api";
import { isDevelopmentEnvironment } from "@/lib/admin/environment";
import {
  activeViewStorageKey,
  defaultViewFor,
  isViewAllowed,
  isViewMode,
  tokenStorageKey,
  userStorageKey,
} from "@/lib/admin/storage";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import {
  emptyWorkspaceUpdateValues,
  workspaceUpdateValues,
  type WorkspaceUpdateValues,
} from "@/lib/admin/workspaces";
import { calendarDateToIso } from "@/lib/format";
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

/**
 * Rewrites the API's engineer-facing rejections into something an office
 * administrator can act on. Anything unrecognised is passed through unchanged
 * rather than swallowed — a message we did not anticipate is still better than
 * a shrug.
 */
function friendlyWorkspaceError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;

  const normalized = message.toLowerCase();
  if (normalized.includes("seatlimit cannot be lower")) {
    return "Number of licenses cannot be lower than the number of people already in this organization.";
  }
  if (normalized.includes("workspace not found")) {
    return "That organization no longer exists. Refresh the list and try again.";
  }
  if (normalized.startsWith("body/") || normalized.includes("expected") || normalized.includes("invalid_type")) {
    return fallback;
  }
  return message;
}

export default function Home() {
  const namePattern = /^[A-Za-z][A-Za-z0-9 ]*$/;
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementResponse | null>(null);
  /**
   * The open section, remembered across reloads.
   *
   * The app is one client-rendered route, so a refresh used to drop the admin
   * back on the home view. The stored value is filtered through the current
   * account's permissions on the way out rather than corrected in an effect:
   * that way a section the signed-in role cannot open can never be rendered,
   * not even for one frame.
   */
  const [storedView, setStoredView] = useLocalStorageState<ViewMode>(
    activeViewStorageKey,
    "overview",
    isViewMode,
  );

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
  /** Calendar date (`YYYY-MM-DD`) from the picker; converted to ISO on submit. */
  const [workspaceExpiresAt, setWorkspaceExpiresAt] = useState("");

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [updateOwnerEmail, setUpdateOwnerEmail] = useState("");
  const [updateSeatLimit, setUpdateSeatLimit] = useState("");
  const [updatePlan, setUpdatePlan] = useState("organization");
  const [updateSubscriptionStatus, setUpdateSubscriptionStatus] = useState("active");
  const [updateStatus, setUpdateStatus] = useState("active");
  const [updateNotes, setUpdateNotes] = useState("");
  /** Calendar date (`YYYY-MM-DD`) from the picker; converted to ISO on submit. */
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
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<number | null>(null);
  /** Workspace whose values are already loaded into the update form. */
  const hydratedWorkspaceIdRef = useRef<string | null>(null);

  const showDevAdminBootstrapTools = isDevelopmentEnvironment();
  const platformAdmin = isPlatformAdmin(currentUser);
  const workspaceManager = isWorkspaceManager(entitlement);

  const activeView = isViewAllowed(storedView, platformAdmin) ? storedView : defaultViewFor(platformAdmin);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [workspaces, selectedWorkspaceId],
  );

  const pendingInvitationsScope = useMemo(() => {
    if (!selectedWorkspaceId) return null;
    if (platformAdmin) {
      return workspaces.find((workspace) => workspace.id === selectedWorkspaceId)?.name ?? null;
    }
    return myWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId)?.name ?? null;
  }, [platformAdmin, workspaces, myWorkspaces, selectedWorkspaceId]);

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

    // "Active" subscriptions mirror the backend's isWorkspaceAccessActive rule,
    // which treats both `active` and `trialing` as entitled.
    const subscribedStatuses = new Set(["active", "trialing"]);

    return {
      totalWorkspaces: sourceRows.length,
      activeWorkspaces: sourceRows.filter((workspace) => workspace.status === "active").length,
      totalActiveSeats: sourceRows.reduce((sum, workspace) => sum + workspace.activeSeatCount, 0),
      usersWithAccess: users.filter((user) => user.hasAccess).length,
      totalUsers: users.length,
      activeSubscriptions: sourceRows.filter((workspace) => subscribedStatuses.has(workspace.subscriptionStatus))
        .length,
      pendingInvitations: members.filter((member) => member.status === "invited").length,
      pendingInvitationsScope,
      canReadAllUsers: platformAdmin,
    };
  }, [platformAdmin, workspaces, myWorkspaces, users, members, pendingInvitationsScope]);

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

  function applyUpdateValues(values: WorkspaceUpdateValues): void {
    setUpdateSeatLimit(values.seatLimit);
    setUpdatePlan(values.plan);
    setUpdateSubscriptionStatus(values.subscriptionStatus);
    setUpdateStatus(values.status);
    setUpdateNotes(values.notes);
    setUpdateExpiresAt(values.expiresAt);
  }

  /**
   * Mirrors the selected workspace into the update form.
   *
   * It keys off the resolved workspace rather than the id because selection can
   * land before the workspace list does — `loadDashboard` auto-selects the first
   * row, and that race is what used to leave the seat limit blank. The ref makes
   * hydration happen once per workspace, so a background refresh never
   * overwrites edits that are already in progress.
   */
  useEffect(() => {
    if (!selectedWorkspaceId) {
      hydratedWorkspaceIdRef.current = null;
      applyUpdateValues(emptyWorkspaceUpdateValues);
      return;
    }
    if (hydratedWorkspaceIdRef.current === selectedWorkspaceId || !selectedWorkspace) return;

    hydratedWorkspaceIdRef.current = selectedWorkspaceId;
    applyUpdateValues(workspaceUpdateValues(selectedWorkspace));
  }, [selectedWorkspaceId, selectedWorkspace]);

  async function loadDashboard(authToken: string, user: AuthUser | null): Promise<void> {
    setIsLoadingDashboard(true);
    setDashboardError(null);
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
      // The view is no longer forced here: `activeView` already falls back to
      // this account's home section whenever the remembered one is out of
      // bounds, and forcing it would undo a reload onto Members or Analytics.
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load dashboard";
      setDashboardError(message);
      showToast("error", message);
    } finally {
      setIsLoadingDashboard(false);
      setLastRefreshedAt(new Date().toISOString());
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

      // Login succeeds only for platform admins or active workspace owner/admin members.
      let entitlementResponse = null;
      try {
        entitlementResponse = await callApi<EntitlementResponse>("entitlements/me", { method: "GET" }, data.accessToken);
      } catch (e) {
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
      // A fresh sign-in starts at this account's home section rather than
      // wherever the previous session — possibly a different person — left off.
      setStoredView(defaultViewFor(data.user.role === "admin"));
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
            // The picker holds a calendar date; the API keeps taking an ISO instant.
            expiresAt: calendarDateToIso(workspaceExpiresAt),
            subscriptionStatus: workspaceSubscriptionStatus,
            status: workspaceStatus,
            notes: workspaceNotes || null,
          }),
        },
        token,
      );
      showToast("success", "Organization created successfully.");
      await loadDashboard(token, currentUser);
      setStoredView("workspaces");
    } catch (error) {
      showToast("error", friendlyWorkspaceError(error, "Could not create the organization. Please check the details and try again."));
    } finally {
      setIsBusy(false);
    }
  }

  /** Resolves true when the save landed, so the update dialog knows to close. */
  async function onUpdateWorkspace(event: FormEvent<HTMLFormElement>): Promise<boolean> {
    event.preventDefault();
    if (!token || !selectedWorkspaceId) return false;
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
            // The picker holds a calendar date; the API keeps taking an ISO
            // instant. An emptied picker is an explicit "no expiry", which the
            // API has always expressed as null.
            expiresAt: calendarDateToIso(updateExpiresAt),
            subscriptionStatus: updateSubscriptionStatus || undefined,
            status: updateStatus || undefined,
            notes: updateNotes || undefined,
          }),
        },
        token,
      );
      showToast("success", "Organization updated successfully.");
      // Re-read the saved record into the form once the refresh lands, so the
      // directory and the form both show what the server now holds.
      hydratedWorkspaceIdRef.current = null;
      await loadDashboard(token, currentUser);
      return true;
    } catch (error) {
      showToast("error", friendlyWorkspaceError(error, "Could not update the organization. Please check the details and try again."));
      return false;
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

  /**
   * Promotes an existing user to platform admin from the Users table.
   *
   * Reuses the existing `POST admin/users/promote-admin` route, which accepts a
   * platform-admin JWT (the bootstrap-token path is only a recovery fallback).
   * No new endpoint is introduced.
   */
  async function onPromoteUserToAdmin(email: string): Promise<void> {
    if (!token) return;
    setIsBusy(true);
    try {
      await callApi(
        "admin/users/promote-admin",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        token,
      );
      showToast("success", `${email} is now a platform admin.`);
      await loadDashboard(token, currentUser);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to promote user");
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
      setActiveView={setStoredView}
      isPlatformAdmin={platformAdmin}
      onRefreshData={() => {
        if (token) void loadDashboard(token, currentUser);
      }}
      clearSession={clearSession}
      isLoadingDashboard={isLoadingDashboard}
      dashboardError={dashboardError}
      lastRefreshedAt={lastRefreshedAt}
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
      onNotify={showToast}
      onPromoteUserToAdmin={platformAdmin ? onPromoteUserToAdmin : null}
    />
  );
}
