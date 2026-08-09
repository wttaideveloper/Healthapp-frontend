export type UserRole = "user" | "admin";
export type UserStatus = "pending" | "active";

export type EntitlementSource = "workspace" | "individual_iap" | "individual_stripe" | null;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hasAccess: boolean;
  isEmailVerified: boolean;
  status: UserStatus;
  entitlement?: {
    source: EntitlementSource;
    expiresAt: string | null;
    providerStatus: string | null;
  };
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type EntitlementResponse = {
  hasAccess: boolean;
  source: EntitlementSource;
  expiresAt: string | null;
  providerStatus: string | null;
  autoRenewing: boolean | null;
  workspace: {
    id: string;
    name: string;
    role: "owner" | "admin" | "member" | string;
    memberStatus: "active" | "invited" | "revoked" | string;
    plan: string;
    seatLimit: number | null;
    subscriptionStatus: "active" | "trialing" | "past_due" | "expired" | "canceled" | string;
  } | null;
  individual: {
    provider: "revenuecat" | "stripe" | string;
    productId: string | null;
    status: string;
  } | null;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  hasAccess: boolean;
  isEmailVerified: boolean;
  createdAt: string;
};

export type Workspace = {
  id: string;
  name: string;
  ownerUserId: string | null;
  ownerEmail: string;
  status: "active" | "suspended" | "revoked" | string;
  subscriptionStatus: "active" | "trialing" | "past_due" | "expired" | "canceled" | string;
  plan: string;
  seatLimit: number | null;
  activeSeatCount: number;
  expiresAt: string | null;
  notes: string | null;
  createdByUserId: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMembership = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member" | string;
  status: "active" | "invited" | "revoked" | string;
  subscriptionStatus: "active" | "trialing" | "past_due" | "expired" | "canceled" | string;
  plan: string;
  seatLimit: number | null;
  activeSeatCount: number;
  expiresAt: string | null;
};

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string | null;
  email: string;
  role: "owner" | "admin" | "member" | string;
  status: "active" | "invited" | "revoked" | string;
  /** Returned by `memberResponseSchema`; null for seats created before tracking. */
  invitedByUserId?: string | null;
  joinedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * One administrative audit event, as returned by `GET admin/audit-logs`.
 *
 * Ids and labels are both present by design: the id says which record, the label
 * keeps the row readable after that record is renamed or deleted. Every field
 * except `action`, `result`, and `createdAt` is nullable — a webhook-driven event
 * has no actor, and a session event has no workspace.
 */
export type AuditLog = {
  id: string;
  /** Machine key, e.g. "workspace.created". */
  action: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  targetLabel: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  result: string;
  /** Action-specific detail; shape varies by action. */
  metadata: unknown;
  createdAt: string;
};

export type ViewMode =
  | "overview"
  | "analytics"
  | "audit"
  | "workspaces"
  | "members"
  | "users"
  | "my-workspaces";
export type ToastType = "success" | "error";

export type ToastState = {
  id: number;
  type: ToastType;
  message: string;
  /** Optional second line, e.g. what the admin can do next. */
  description?: string;
} | null;

export type DashboardMetrics = {
  totalWorkspaces: number;
  activeWorkspaces: number;
  totalActiveSeats: number;
  usersWithAccess: number;
  /** Count from `admin/users`. Platform-admin only endpoint. */
  totalUsers: number;
  /** Workspaces whose subscriptionStatus is `active` or `trialing`. */
  activeSubscriptions: number;
  /**
   * Members with status `invited` among the members currently loaded.
   * Scoped to the selected workspace — see `pendingInvitationsScope`.
   */
  pendingInvitations: number;
  /** Name of the workspace `pendingInvitations` covers, or null when none is loaded. */
  pendingInvitationsScope: string | null;
  /** False for workspace managers, who cannot call `admin/users`. */
  canReadAllUsers: boolean;
};
