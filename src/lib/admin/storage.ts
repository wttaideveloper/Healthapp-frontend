import type { ViewMode } from "@/types/admin";

export const tokenStorageKey = "healthage.admin.token";
export const userStorageKey = "healthage.admin.user";
/** Survives a reload so refreshing does not throw the admin back to the home view. */
export const activeViewStorageKey = "healthage.admin.activeView";

/**
 * Which sections each kind of account may open.
 *
 * Mirrors the navigation in `AdminSidebar` and the render gates in
 * `AdminDashboard` — a restored view has to be checked against these, or a
 * workspace administrator who once signed in as a platform admin on the same
 * browser would land on a section that renders nothing at all.
 */
const platformViews: readonly ViewMode[] = ["overview", "analytics", "workspaces", "members", "users", "audit"];
const workspaceViews: readonly ViewMode[] = ["my-workspaces", "analytics", "members"];

const allViews: readonly ViewMode[] = [...platformViews, "my-workspaces"];

export function isViewMode(value: unknown): value is ViewMode {
  return typeof value === "string" && allViews.includes(value as ViewMode);
}

/** The section an account opens on when nothing else is remembered. */
export function defaultViewFor(isPlatformAdmin: boolean): ViewMode {
  return isPlatformAdmin ? "overview" : "my-workspaces";
}

export function isViewAllowed(view: ViewMode, isPlatformAdmin: boolean): boolean {
  return (isPlatformAdmin ? platformViews : workspaceViews).includes(view);
}
