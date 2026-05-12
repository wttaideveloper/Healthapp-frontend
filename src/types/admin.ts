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
  joinedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ViewMode = "overview" | "workspaces" | "members" | "users" | "my-workspaces";
export type ToastType = "success" | "error";

export type ToastState = {
  id: number;
  type: ToastType;
  message: string;
} | null;

export type DashboardMetrics = {
  totalWorkspaces: number;
  activeWorkspaces: number;
  totalActiveSeats: number;
  usersWithAccess: number;
};
