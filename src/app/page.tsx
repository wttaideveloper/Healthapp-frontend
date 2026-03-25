"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  isLicensed: boolean;
  isEmailVerified: boolean;
  status: "pending" | "active";
  licenseId: string | null;
};

type LoginResponse = {
  accessToken: string;
};

type License = {
  id: string;
  organizationName: string;
  allowedEmailDomain: string | null;
  maxActivations: number | null;
  expiresAt: string | null;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  activationCount: number;
};

type Activation = {
  activationId: string;
  userId: string;
  name: string;
  email: string;
  deviceId: string;
  platform: string | null;
  activatedAt: string;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  status: "pending" | "active";
  isLicensed: boolean;
  isEmailVerified: boolean;
  licenseId: string | null;
  createdAt: string;
};

type CreateLicenseResponse = {
  licenseKey: string;
  license: License;
};

type ViewMode = "overview" | "licenses" | "users";
type ToastType = "success" | "error";

type ToastState = {
  id: number;
  type: ToastType;
  message: string;
} | null;

const tokenStorageKey = "healthage.admin.token";
const userStorageKey = "healthage.admin.user";
const licenseKeyStoreKey = "healthage.admin.licenseKeysById";

async function parseApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = payload?.error?.message ?? payload?.message ?? "Request failed";
    throw new Error(message);
  }

  return payload as T;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>("overview");

  const [loginEmail, setLoginEmail] = useState("admin@conference.org");
  const [loginPassword, setLoginPassword] = useState("Password123!");

  const [bootstrapToken, setBootstrapToken] = useState("");
  const [bootstrapName, setBootstrapName] = useState("Platform Admin");
  const [bootstrapEmail, setBootstrapEmail] = useState("admin@conference.org");
  const [bootstrapPassword, setBootstrapPassword] = useState("Password123!");
  const [promoteEmail, setPromoteEmail] = useState("admin@conference.org");

  const [licenseOrgName, setLicenseOrgName] = useState("North Conference");
  const [licenseDomain, setLicenseDomain] = useState("conference.org");
  const [licenseMaxActivations, setLicenseMaxActivations] = useState("500");
  const [newLicenseKey, setNewLicenseKey] = useState<string | null>(null);

  const [selectedLicenseId, setSelectedLicenseId] = useState<string>("");
  const [updateMaxActivations, setUpdateMaxActivations] = useState("");
  const [updateIsActive, setUpdateIsActive] = useState(true);

  const [newAdminName, setNewAdminName] = useState("Regional Admin");
  const [newAdminEmail, setNewAdminEmail] = useState("regional.admin@conference.org");
  const [newAdminPassword, setNewAdminPassword] = useState("Password123!");

  const [licenses, setLicenses] = useState<License[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [licenseKeysById, setLicenseKeysById] = useState<Record<string, string>>({});
  const [shownLicenseKeys, setShownLicenseKeys] = useState<Record<string, boolean>>({});
  const [openLicenseMenuId, setOpenLicenseMenuId] = useState<string | null>(null);
  const licenseMenuAnchorRef = useRef<HTMLElement | null>(null);
  const [licenseMenuAnchorRect, setLicenseMenuAnchorRect] = useState<DOMRect | null>(null);

  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<number | null>(null);

  const selectedLicense = useMemo(
    () => licenses.find((license) => license.id === selectedLicenseId) ?? null,
    [licenses, selectedLicenseId],
  );

  const metrics = useMemo(() => {
    const totalLicenses = licenses.length;
    const activeLicenses = licenses.filter((license) => license.isActive).length;
    const totalActivations = licenses.reduce((sum, license) => sum + license.activationCount, 0);
    const licensedUsers = users.filter((user) => user.isLicensed).length;

    return {
      totalLicenses,
      activeLicenses,
      totalActivations,
      licensedUsers,
    };
  }, [licenses, users]);

  function showToast(type: ToastType, message: string): void {
    const nextToast = {
      id: Date.now(),
      type,
      message,
    };

    setToast(nextToast);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToast((existing) => (existing?.id === nextToast.id ? null : existing));
    }, 3200);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!openLicenseMenuId) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenLicenseMenuId(null);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-license-menu-root]")) return;
      setOpenLicenseMenuId(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openLicenseMenuId]);

  useEffect(() => {
    if (!openLicenseMenuId) return;

    let rafId: number | null = null;

    function updateRect() {
      if (!licenseMenuAnchorRef.current) return;
      setLicenseMenuAnchorRect(licenseMenuAnchorRef.current.getBoundingClientRect());
    }

    function onScrollOrResize() {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateRect();
      });
    }

    updateRect();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [openLicenseMenuId]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(tokenStorageKey);
    const savedUser = window.localStorage.getItem(userStorageKey);
    const savedKeys = window.localStorage.getItem(licenseKeyStoreKey);

    if (savedToken) {
      setToken(savedToken);
    }

    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch {
        window.localStorage.removeItem(userStorageKey);
      }
    }

    if (savedKeys) {
      try {
        const parsed = JSON.parse(savedKeys) as Record<string, string>;
        if (parsed && typeof parsed === "object") {
          setLicenseKeysById(parsed);
        }
      } catch {
        window.localStorage.removeItem(licenseKeyStoreKey);
      }
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    void loadDashboard(token);
  }, [token]);

  async function callApi<T>(path: string, init?: RequestInit, bearer?: string): Promise<T> {
    const response = await fetch(`/api/proxy/${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      cache: "no-store",
    });

    return parseApiResponse<T>(response);
  }

  async function loadDashboard(authToken: string): Promise<void> {
    setIsLoadingDashboard(true);

    try {
      const [licenseRows, userRows] = await Promise.all([
        callApi<License[]>("admin/licenses", { method: "GET" }, authToken),
        callApi<AdminUser[]>("admin/users", { method: "GET" }, authToken),
      ]);

      setLicenses(licenseRows);
      setUsers(userRows);

      if (licenseRows.length > 0) {
        const nextSelected = selectedLicenseId || licenseRows[0].id;
        setSelectedLicenseId(nextSelected);
        await loadActivations(authToken, nextSelected);
      } else {
        setSelectedLicenseId("");
        setActivations([]);
      }
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to load dashboard");
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function loadActivations(authToken: string, licenseId: string): Promise<void> {
    if (!licenseId) {
      setActivations([]);
      return;
    }

    try {
      const rows = await callApi<Activation[]>(`admin/licenses/${licenseId}/activations`, { method: "GET" }, authToken);
      setActivations(rows);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to load activations");
      setActivations([]);
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
    setLicenses([]);
    setUsers([]);
    setActivations([]);
    setSelectedLicenseId("");
    window.localStorage.removeItem(tokenStorageKey);
    window.localStorage.removeItem(userStorageKey);
  }

  function storeLicenseKey(licenseId: string, licenseKey: string): void {
    const normalized = licenseKey.trim();
    setLicenseKeysById((existing) => {
      const next = { ...existing, [licenseId]: normalized };
      window.localStorage.setItem(licenseKeyStoreKey, JSON.stringify(next));
      return next;
    });
  }

  async function copyToClipboard(text: string): Promise<void> {
    const value = text.trim();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      showToast("success", "Copied to clipboard.");
    } catch {
      showToast("error", "Copy failed. Your browser blocked clipboard access.");
    }
  }

  async function onLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsBusy(true);

    try {
      const data = await callApi<LoginResponse>("auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const me = await callApi<AuthUser>("auth/me", { method: "GET" }, data.accessToken);

      if (me.role !== "admin") {
        throw new Error(`This account role is '${me.role}', not admin.`);
      }

      saveSession(data.accessToken, me);
      showToast("success", "Signed in successfully.");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Login failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function onBootstrapAdmin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsBusy(true);

    try {
      await callApi<{ id: string }>("admin/users/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bootstrap-token": bootstrapToken,
        },
        body: JSON.stringify({
          name: bootstrapName,
          email: bootstrapEmail,
          password: bootstrapPassword,
        }),
      });

      showToast("success", "Initial admin created. You can now log in.");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to create first admin");
    } finally {
      setIsBusy(false);
    }
  }

  async function onPromoteAdmin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsBusy(true);

    try {
      await callApi<{ id: string }>("admin/users/promote-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-bootstrap-token": bootstrapToken,
        },
        body: JSON.stringify({
          email: promoteEmail,
        }),
      });

      showToast("success", "User promoted to admin. You can now sign in.");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to promote user");
    } finally {
      setIsBusy(false);
    }
  }

  async function onCreateLicense(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) return;

    setIsBusy(true);

    try {
      const data = await callApi<CreateLicenseResponse>(
        "admin/licenses",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationName: licenseOrgName,
            allowedEmailDomain: licenseDomain || undefined,
            maxActivations: licenseMaxActivations ? Number(licenseMaxActivations) : undefined,
            isActive: true,
          }),
        },
        token,
      );

      setNewLicenseKey(data.licenseKey);
      storeLicenseKey(data.license.id, data.licenseKey);
      showToast("success", "License created.");
      await loadDashboard(token);
      setActiveView("licenses");
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to create license");
    } finally {
      setIsBusy(false);
    }
  }

  async function onUpdateLicense(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token || !selectedLicenseId) return;

    setIsBusy(true);

    try {
      await callApi<License>(
        `admin/licenses/${selectedLicenseId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive: updateIsActive,
            maxActivations: updateMaxActivations ? Number(updateMaxActivations) : null,
          }),
        },
        token,
      );

      showToast("success", "License updated.");
      await loadDashboard(token);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to update license");
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleLicenseActive(licenseId: string, nextIsActive: boolean): Promise<void> {
    if (!token) return;
    setIsBusy(true);

    try {
      await callApi<License>(
        `admin/licenses/${licenseId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: nextIsActive }),
        },
        token,
      );
      showToast("success", nextIsActive ? "License activated." : "License deactivated.");
      await loadDashboard(token);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to update license status");
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteLicense(licenseId: string): Promise<void> {
    if (!token) return;
    const confirmed = window.confirm("Delete this license? This will remove it and its activation records.");
    if (!confirmed) return;

    setIsBusy(true);
    try {
      await callApi<{ deleted: true }>(`admin/licenses/${licenseId}`, { method: "DELETE" }, token);
      showToast("success", "License deleted.");
      await loadDashboard(token);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to delete license");
    } finally {
      setIsBusy(false);
    }
  }

  async function onCreateAdmin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!token) return;

    setIsBusy(true);

    try {
      await callApi<{ id: string }>(
        "admin/users/admin",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newAdminName,
            email: newAdminEmail,
            password: newAdminPassword,
          }),
        },
        token,
      );

      showToast("success", "Admin user created.");
      await loadDashboard(token);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Failed to create admin user");
    } finally {
      setIsBusy(false);
    }
  }

  async function onLicenseSelectionChange(licenseId: string): Promise<void> {
    setSelectedLicenseId(licenseId);
    if (!token) return;
    await loadActivations(token, licenseId);
  }

  function openLicenseMenu(licenseId: string, anchorEl: HTMLElement): void {
    licenseMenuAnchorRef.current = anchorEl;
    setLicenseMenuAnchorRect(anchorEl.getBoundingClientRect());
    setOpenLicenseMenuId((current) => (current === licenseId ? null : licenseId));
  }

  const navigation = [
    { key: "overview" as const, label: "Dashboard Home" },
    { key: "licenses" as const, label: "Licenses" },
    { key: "users" as const, label: "Users" },
  ];

  if (!token || !currentUser) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 md:px-10">
        {toast ? <ToastMessage type={toast.type} message={toast.message} /> : null}

        <section className="mb-10 rounded-3xl border border-border/80 bg-card/90 p-8 shadow-[0_16px_50px_rgba(15,23,42,0.10)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.28em] text-accent">HealthAge Admin Console</p>
          <h1 className="mt-3 text-3xl font-semibold text-foreground md:text-4xl">Organization License Control Plane</h1>
          <p className="mt-3 max-w-2xl text-sm text-foreground/75">
            Manage conference/union site licenses, monitor activations, and control admin access from one place.
          </p>
        </section>

        <div className="grid gap-6 md:grid-cols-2">
          <form onSubmit={onLogin} className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Admin Login</h2>
            <p className="mt-1 text-sm text-foreground/70">Sign in with an existing admin account.</p>

            <div className="mt-5 grid gap-3">
              <input
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                placeholder="admin@conference.org"
                type="email"
                required
              />
              <input
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                placeholder="Password"
                type="password"
                required
              />
            </div>

            <button
              disabled={isBusy}
              className="mt-5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
            >
              {isBusy ? "Please wait..." : "Sign In"}
            </button>
          </form>

          <form onSubmit={onBootstrapAdmin} className="rounded-3xl border border-border bg-card-2 p-6 shadow-sm">
            <h2 className="text-lg font-semibold">First Admin Bootstrap</h2>
            <p className="mt-1 text-sm text-foreground/70">Use once when no admin exists. Requires `ADMIN_BOOTSTRAP_TOKEN`.</p>

            <div className="mt-5 grid gap-3">
              <input
                value={bootstrapToken}
                onChange={(event) => setBootstrapToken(event.target.value)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                placeholder="Bootstrap token"
                required
              />
              <input
                value={bootstrapName}
                onChange={(event) => setBootstrapName(event.target.value)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                placeholder="Admin name"
                required
              />
              <input
                value={bootstrapEmail}
                onChange={(event) => setBootstrapEmail(event.target.value)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                placeholder="Admin email"
                type="email"
                required
              />
              <input
                value={bootstrapPassword}
                onChange={(event) => setBootstrapPassword(event.target.value)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                placeholder="Admin password"
                type="password"
                required
              />
            </div>

            <button
              disabled={isBusy}
              className="mt-5 rounded-xl bg-accent-2 px-4 py-2 text-sm font-semibold text-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
            >
              {isBusy ? "Please wait..." : "Create First Admin"}
            </button>
          </form>
        </div>

        <form onSubmit={onPromoteAdmin} className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Promote Existing User To Admin</h2>
          <p className="mt-1 text-sm text-foreground/70">
            If you registered with a normal account first, promote it using the same bootstrap token.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input
              value={bootstrapToken}
              onChange={(event) => setBootstrapToken(event.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              placeholder="Bootstrap token"
              required
            />
            <input
              value={promoteEmail}
              onChange={(event) => setPromoteEmail(event.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              placeholder="Existing user email"
              type="email"
              required
            />
          </div>

          <button
            disabled={isBusy}
            className="mt-5 rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
          >
            {isBusy ? "Please wait..." : "Promote To Admin"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8">
      {toast ? <ToastMessage type={toast.type} message={toast.message} /> : null}

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="rounded-3xl border border-border bg-card p-4 shadow-sm md:sticky md:top-6 md:h-[calc(100vh-3rem)]">
          <div className="mb-4 rounded-2xl bg-muted p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-accent">HealthAge</p>
            <p className="mt-1 text-sm font-semibold">{currentUser.name}</p>
            <p className="text-xs text-foreground/70">{currentUser.email}</p>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
            {navigation.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveView(item.key)}
                className={`shrink-0 rounded-xl px-3 py-2 text-left text-sm transition ${
                  activeView === item.key
                    ? "bg-foreground text-white"
                    : "border border-border bg-white text-foreground hover:bg-muted"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={clearSession}
            className="mt-4 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            Logout
          </button>
        </aside>

        <section className="space-y-6">
          <header className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-accent">Admin Dashboard</p>
                <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{activeView === "overview" ? "Dashboard Home" : activeView === "licenses" ? "Licenses" : "Users"}</h1>
              </div>

              <button
                type="button"
                onClick={() => token && loadDashboard(token)}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Refresh Data
              </button>
            </div>
          </header>

          {activeView === "overview" ? (
            <section className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total Licenses" value={metrics.totalLicenses} />
                <MetricCard label="Active Licenses" value={metrics.activeLicenses} />
                <MetricCard label="Total Activations" value={metrics.totalActivations} />
                <MetricCard label="Licensed Users" value={metrics.licensedUsers} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                  <h2 className="text-lg font-semibold">Recent Licenses</h2>
                  <div className="mt-4 grid gap-3">
                    {licenses.slice(0, 4).map((license) => (
                      <button
                        key={license.id}
                        type="button"
                        onClick={() => {
                          setActiveView("licenses");
                          void onLicenseSelectionChange(license.id);
                        }}
                        className="rounded-xl border border-border bg-white p-3 text-left hover:bg-muted"
                      >
                        <p className="text-sm font-semibold">{license.organizationName}</p>
                        <p className="mt-1 text-xs text-foreground/70">
                          {license.allowedEmailDomain ?? "Any domain"} • {license.activationCount} activations
                        </p>
                      </button>
                    ))}
                    {licenses.length === 0 ? <p className="text-sm text-foreground/70">No licenses yet.</p> : null}
                  </div>
                </article>

                <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                  <h2 className="text-lg font-semibold">User Snapshot</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {users.slice(0, 4).map((user) => (
                      <div key={user.id} className="rounded-xl border border-border bg-white p-3">
                        <p className="text-sm font-semibold">{user.name}</p>
                        <p className="text-xs text-foreground/70">{user.email}</p>
                        <p className="mt-1 text-xs uppercase text-accent">{user.role}</p>
                      </div>
                    ))}
                    {users.length === 0 ? <p className="text-sm text-foreground/70">No users yet.</p> : null}
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {activeView === "licenses" ? (
            <section className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <form className="rounded-3xl border border-border bg-card p-5 shadow-sm" onSubmit={onCreateLicense}>
                  <h2 className="text-lg font-semibold">Create License</h2>
                  <div className="mt-4 grid gap-3">
                    <input
                      value={licenseOrgName}
                      onChange={(event) => setLicenseOrgName(event.target.value)}
                      className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                      placeholder="Organization name"
                      required
                    />
                    <input
                      value={licenseDomain}
                      onChange={(event) => setLicenseDomain(event.target.value)}
                      className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                      placeholder="Allowed domains (conference.org,gmail.com)"
                    />
                    <input
                      value={licenseMaxActivations}
                      onChange={(event) => setLicenseMaxActivations(event.target.value)}
                      className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                      placeholder="Max activations"
                      type="number"
                      min={1}
                    />
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Create License
                    </button>
                  </div>
                  {newLicenseKey ? (
                    <p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 font-mono text-xs text-accent">
                      New license key: {newLicenseKey}
                    </p>
                  ) : null}
                </form>

                <form className="rounded-3xl border border-border bg-card p-5 shadow-sm" onSubmit={onUpdateLicense}>
                  <h2 className="text-lg font-semibold">Update Selected License</h2>
                  <div className="mt-4 grid gap-3">
                    <select
                      value={selectedLicenseId}
                      onChange={(event) => {
                        void onLicenseSelectionChange(event.target.value);
                      }}
                      className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select license</option>
                      {licenses.map((license) => (
                        <option key={license.id} value={license.id}>
                          {license.organizationName}
                        </option>
                      ))}
                    </select>

                    <input
                      value={updateMaxActivations}
                      onChange={(event) => setUpdateMaxActivations(event.target.value)}
                      className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                      placeholder="New max activations"
                      type="number"
                      min={1}
                    />

                    <label className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={updateIsActive}
                        onChange={(event) => setUpdateIsActive(event.target.checked)}
                      />
                      License Active
                    </label>

                    <button
                      type="submit"
                      disabled={!selectedLicenseId || isBusy}
                      className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Update License
                    </button>
                  </div>
                </form>
              </div>

              <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-lg font-semibold">License Directory</h2>

                <div className="mt-4 grid gap-3 md:hidden">
                  {licenses.map((license) => (
                    <button
                      key={license.id}
                      type="button"
                      onClick={() => {
                        void onLicenseSelectionChange(license.id);
                      }}
                      className={`rounded-2xl border p-4 text-left ${selectedLicenseId === license.id ? "border-accent bg-accent/5" : "border-border bg-white"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{license.organizationName}</p>
                          <p className="mt-1 text-xs text-foreground/70">Domains: {license.allowedEmailDomain ?? "Any"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                              license.isActive ? "bg-accent/10 text-accent" : "bg-zinc-200 text-zinc-700"
                            }`}
                          >
                            {license.isActive ? "Active" : "Disabled"}
                          </span>
                          <div className="relative" data-license-menu-root>
                            <button
                              type="button"
                              aria-label="License actions"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openLicenseMenu(license.id, event.currentTarget);
                              }}
                              className="rounded-xl border border-border bg-white p-2 hover:bg-muted"
                            >
                              <KebabIcon />
                            </button>
                            {openLicenseMenuId === license.id ? (
                              <LicenseActionsMenu
                                anchorRect={licenseMenuAnchorRect}
                                hasKey={Boolean(licenseKeysById[license.id])}
                                isKeyShown={Boolean(shownLicenseKeys[license.id])}
                                isActive={license.isActive}
                                onRequestClose={() => setOpenLicenseMenuId(null)}
                                onToggleKey={() =>
                                  setShownLicenseKeys((existing) => ({ ...existing, [license.id]: !existing[license.id] }))
                                }
                                onCopyKey={() => void copyToClipboard(licenseKeysById[license.id] ?? "")}
                                onToggleActive={() => void toggleLicenseActive(license.id, !license.isActive)}
                                onDelete={() => void deleteLicense(license.id)}
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-foreground/70">Usage: {license.activationCount} / {license.maxActivations ?? "unlimited"}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-muted px-2 py-1 font-mono text-[11px]">
                          {licenseKeysById[license.id]
                            ? shownLicenseKeys[license.id]
                              ? licenseKeysById[license.id]
                              : "ORG-••••••-••••••-••••••-••••••"
                            : "Key not stored"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border md:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted text-left text-xs uppercase tracking-wider text-foreground/70">
                      <tr>
                        <th className="px-3 py-2">Organization</th>
                        <th className="px-3 py-2">Domain</th>
                        <th className="px-3 py-2">Max</th>
                        <th className="px-3 py-2">Used</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">License Key</th>
                        <th className="px-3 py-2">Actions</th>
                        <th className="px-3 py-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {licenses.map((license) => (
                        <tr
                          key={license.id}
                          onClick={() => {
                            void onLicenseSelectionChange(license.id);
                          }}
                          className={`cursor-pointer border-t ${selectedLicenseId === license.id ? "bg-accent/10" : "bg-white/80 hover:bg-muted/60"}`}
                        >
                          <td className="px-3 py-2">{license.organizationName}</td>
                          <td className="px-3 py-2">{license.allowedEmailDomain ?? "Any"}</td>
                          <td className="px-3 py-2">{license.maxActivations ?? "Unlimited"}</td>
                          <td className="px-3 py-2">{license.activationCount}</td>
                          <td className="px-3 py-2">{license.isActive ? "Active" : "Disabled"}</td>
                          <td className="px-3 py-2">
                            {licenseKeysById[license.id] ? (
                              <span className="rounded-md bg-white px-2 py-1 font-mono text-xs">
                                {shownLicenseKeys[license.id]
                                  ? licenseKeysById[license.id]
                                  : "ORG-••••••-••••••-••••••-••••••"}
                              </span>
                            ) : (
                              <span className="text-xs text-foreground/60">Not available</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="inline-flex" data-license-menu-root>
                              <button
                                type="button"
                                aria-label="License actions"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openLicenseMenu(license.id, event.currentTarget);
                                }}
                                className="rounded-lg border border-border bg-white p-2 hover:bg-muted"
                              >
                                <KebabIcon />
                              </button>
                              {openLicenseMenuId === license.id ? (
                                <LicenseActionsMenu
                                  anchorRect={licenseMenuAnchorRect}
                                  hasKey={Boolean(licenseKeysById[license.id])}
                                  isKeyShown={Boolean(shownLicenseKeys[license.id])}
                                  isActive={license.isActive}
                                  onRequestClose={() => setOpenLicenseMenuId(null)}
                                  onToggleKey={() =>
                                    setShownLicenseKeys((existing) => ({ ...existing, [license.id]: !existing[license.id] }))
                                  }
                                  onCopyKey={() => void copyToClipboard(licenseKeysById[license.id] ?? "")}
                                  onToggleActive={() => void toggleLicenseActive(license.id, !license.isActive)}
                                  onDelete={() => void deleteLicense(license.id)}
                                />
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2">{formatDateTime(license.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Activations {selectedLicense ? `for ${selectedLicense.organizationName}` : ""}</h2>
                <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border md:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted text-left text-xs uppercase tracking-wider text-foreground/70">
                      <tr>
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Device</th>
                        <th className="px-3 py-2">Platform</th>
                        <th className="px-3 py-2">Activated At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activations.map((activation) => (
                        <tr key={activation.activationId} className="border-t bg-white/80">
                          <td className="px-3 py-2">{activation.name}</td>
                          <td className="px-3 py-2">{activation.email}</td>
                          <td className="px-3 py-2 font-mono text-xs">{activation.deviceId}</td>
                          <td className="px-3 py-2">{activation.platform ?? "-"}</td>
                          <td className="px-3 py-2">{formatDateTime(activation.activatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid gap-3 md:hidden">
                  {activations.map((activation) => (
                    <div key={activation.activationId} className="rounded-2xl border border-border bg-white p-4">
                      <p className="text-sm font-semibold">{activation.name}</p>
                      <p className="text-xs text-foreground/70">{activation.email}</p>
                      <p className="mt-1 font-mono text-xs">{activation.deviceId}</p>
                      <p className="text-xs text-foreground/70">{activation.platform ?? "-"}</p>
                      <p className="text-xs text-foreground/70">{formatDateTime(activation.activatedAt)}</p>
                    </div>
                  ))}
                  {activations.length === 0 ? <p className="text-sm text-foreground/70">No activations for selected license.</p> : null}
                </div>
              </article>
            </section>
          ) : null}

          {activeView === "users" ? (
            <section className="space-y-6">
              <form className="rounded-3xl border border-border bg-card p-5 shadow-sm" onSubmit={onCreateAdmin}>
                <h2 className="text-lg font-semibold">Create Admin User</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <input
                    value={newAdminName}
                    onChange={(event) => setNewAdminName(event.target.value)}
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                    placeholder="Admin name"
                    required
                  />
                  <input
                    value={newAdminEmail}
                    onChange={(event) => setNewAdminEmail(event.target.value)}
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                    placeholder="Admin email"
                    type="email"
                    required
                  />
                  <input
                    value={newAdminPassword}
                    onChange={(event) => setNewAdminPassword(event.target.value)}
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                    placeholder="Password"
                    type="password"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="rounded-xl bg-accent-2 px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                  >
                    Create Admin
                  </button>
                </div>
              </form>

              <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
                <h2 className="text-lg font-semibold">Users Directory</h2>

                <div className="mt-4 grid gap-3 md:hidden">
                  {users.map((user) => (
                    <div key={user.id} className="rounded-2xl border border-border bg-white p-4">
                      <p className="text-sm font-semibold">{user.name}</p>
                      <p className="text-xs text-foreground/70">{user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-muted px-2 py-1 text-xs uppercase">{user.role}</span>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs">{user.status}</span>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs">{user.isLicensed ? "Licensed" : "Not Licensed"}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border md:block">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted text-left text-xs uppercase tracking-wider text-foreground/70">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Role</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Licensed</th>
                        <th className="px-3 py-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-t bg-white/80">
                          <td className="px-3 py-2">{user.name}</td>
                          <td className="px-3 py-2">{user.email}</td>
                          <td className="px-3 py-2 uppercase">{user.role}</td>
                          <td className="px-3 py-2">{user.status}</td>
                          <td className="px-3 py-2">{user.isLicensed ? "Yes" : "No"}</td>
                          <td className="px-3 py-2">{formatDateTime(user.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          ) : null}

          {isLoadingDashboard ? <p className="text-sm text-foreground/70">Loading dashboard...</p> : null}
        </section>
      </div>
    </main>
  );
}

function ToastMessage({ type, message }: { type: ToastType; message: string }) {
  const style =
    type === "success"
      ? "border-accent/30 bg-accent/10 text-accent"
      : "border-danger/30 bg-danger/10 text-danger";

  return (
    <div className={`fixed right-4 top-4 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg ${style}`}>
      {message}
    </div>
  );
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="4.5" r="1.6" fill="currentColor" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" />
      <circle cx="10" cy="15.5" r="1.6" fill="currentColor" />
    </svg>
  );
}

function LicenseActionsMenu(props: {
  anchorRect: DOMRect | null;
  hasKey: boolean;
  isKeyShown: boolean;
  isActive: boolean;
  onRequestClose: () => void;
  onToggleKey: () => void;
  onCopyKey: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const items: Array<{
    key: string;
    label: string;
    tone?: "danger";
    disabled?: boolean;
    onClick: () => void;
  }> = [];

  if (props.hasKey) {
    items.push({
      key: "toggle-key",
      label: props.isKeyShown ? "Hide license key" : "Show license key",
      onClick: props.onToggleKey,
    });
    items.push({
      key: "copy-key",
      label: "Copy license key",
      onClick: props.onCopyKey,
    });
  }

  items.push({
    key: "toggle-active",
    label: props.isActive ? "Deactivate" : "Activate",
    onClick: props.onToggleActive,
  });

  items.push({
    key: "delete",
    label: "Delete",
    tone: "danger",
    onClick: props.onDelete,
  });

  if (!props.anchorRect) return null;

  const menuWidth = 224;
  const estimatedMenuHeight = 220;
  const margin = 10;

  const placeAbove = props.anchorRect.bottom + 8 + estimatedMenuHeight > window.innerHeight - margin;
  const top = placeAbove ? props.anchorRect.top - 8 : props.anchorRect.bottom + 8;
  const left = Math.min(Math.max(props.anchorRect.right, menuWidth + margin), window.innerWidth - margin);
  const transform = placeAbove ? "translate(-100%, -100%)" : "translate(-100%, 0)";

  return createPortal(
    <div
      data-license-menu-root
      role="menu"
      style={{
        position: "fixed",
        top,
        left,
        transform,
      }}
      className="z-50 w-56 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="p-1">
        {items.map((item) => (
          <button
            key={item.key}
            role="menuitem"
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              props.onRequestClose();
            }}
            className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
              item.tone === "danger" ? "text-danger hover:bg-danger/10" : "text-foreground hover:bg-muted"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-foreground/65">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </article>
  );
}
