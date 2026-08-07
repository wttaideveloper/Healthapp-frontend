"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { AuthUser, ViewMode } from "@/types/admin";

/**
 * Sidebar contents — brand, navigation, account.
 *
 * Rendered twice by the shell: once as the persistent desktop rail and once
 * inside the mobile overlay. Keeping it in one component is what guarantees the
 * two can never drift apart.
 *
 * `collapsed` only applies on desktop. Labels are removed from the flow rather
 * than hidden with opacity so the rail genuinely narrows, and each item keeps an
 * accessible name via `title` + `aria-label`.
 */

export type NavItem = { key: ViewMode; label: string; icon: IconName };

type AdminSidebarProps = {
  nav: NavItem[];
  activeView: ViewMode;
  onNavigate: (view: ViewMode) => void;
  currentUser: AuthUser;
  isPlatformAdmin: boolean;
  onSignOut: () => void;
  collapsed?: boolean;
  /** Desktop-only rail toggle. Omitted inside the mobile overlay. */
  onToggleCollapse?: () => void;
  /** Rendered top-right inside the overlay — the close button. */
  headerAction?: React.ReactNode;
};

export function AdminSidebar({
  nav,
  activeView,
  onNavigate,
  currentUser,
  isPlatformAdmin,
  onSignOut,
  collapsed = false,
  onToggleCollapse,
  headerAction,
}: AdminSidebarProps) {
  const roleLabel = isPlatformAdmin ? "Platform admin" : "Workspace admin";

  return (
    <div className="flex h-full flex-col bg-[color:var(--card)]">
      {/* ------------------------------------------------------------ Brand */}
      <div
        className={`flex h-[var(--header-height)] shrink-0 items-center gap-2.5 border-b border-[color:var(--border)] ${
          collapsed ? "justify-center px-3" : "px-4"
        }`}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--accent)] text-white shadow-[var(--shadow-xs)]"
        >
          <Icon name="shield" size={17} />
        </span>

        {!collapsed ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-semibold leading-tight tracking-[-0.01em]">
                HealthAge
              </p>
              <p className="truncate text-[0.6875rem] leading-tight text-[color:var(--text-subtle)]">
                Admin Console
              </p>
            </div>
            {headerAction}
            {onToggleCollapse ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="ha-btn ha-btn-ghost ha-btn-icon ha-btn-sm hidden shrink-0 lg:inline-flex"
              >
                <Icon name="chevronsLeft" size={14} />
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {/* Expanding from the collapsed rail needs its own affordance. */}
      {collapsed && onToggleCollapse ? (
        <div className="flex justify-center px-2.5 pt-2.5">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="ha-btn ha-btn-ghost ha-btn-icon ha-btn-sm"
          >
            <Icon name="chevronsRight" size={14} />
          </button>
        </div>
      ) : null}

      {/* ------------------------------------------------------- Navigation */}
      <nav
        aria-label="Dashboard sections"
        className={`ha-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto py-3 ${collapsed ? "px-2.5" : "px-3"}`}
      >
        {!collapsed ? (
          <p className="ha-eyebrow px-2 pb-1.5 pt-1">Manage</p>
        ) : null}

        {nav.map((item) => {
          const isActive = activeView === item.key;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={isActive ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              onClick={() => onNavigate(item.key)}
              className={`ha-nav-item ${isActive ? "ha-nav-item-active" : ""} ${
                collapsed ? "justify-center px-0" : ""
              }`}
            >
              <Icon name={item.icon} size={16} />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </button>
          );
        })}
      </nav>

      {/* ---------------------------------------------------------- Account */}
      <div className={`shrink-0 border-t border-[color:var(--border)] ${collapsed ? "p-2.5" : "p-3"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <Avatar name={currentUser.name} size="sm" />
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="ha-btn ha-btn-ghost ha-btn-icon ha-btn-sm"
            >
              <Icon name="logout" size={14} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 rounded-[var(--radius-lg)] bg-[color:var(--card-2)] px-2.5 py-2">
              <Avatar name={currentUser.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.8125rem] font-medium leading-tight">{currentUser.name}</p>
                <p className="truncate text-[0.6875rem] leading-tight text-[color:var(--text-subtle)]">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={`ha-badge ${isPlatformAdmin ? "ha-badge-warning" : "ha-badge-info"}`}>
                <Icon name={isPlatformAdmin ? "shield" : "building"} size={10} />
                {roleLabel}
              </span>
              <button type="button" onClick={onSignOut} className="ha-btn ha-btn-ghost ha-btn-sm" title="Sign out">
                <Icon name="logout" size={13} />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
