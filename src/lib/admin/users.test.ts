import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { confirmationMatches } from "./confirmation";
import { getUserDeactivateCapabilities, getUserPermanentDeleteCapabilities, isSoleOwnerOfActiveWorkspace } from "./users";
import type { AdminUser, Workspace, WorkspaceMember } from "@/types/admin";

const ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OTHER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const WS_A = "11111111-1111-1111-1111-111111111111";

function user(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: USER_ID,
    name: "Pat Member",
    email: "pat@example.com",
    role: "user",
    status: "active",
    hasAccess: true,
    isEmailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: WS_A,
    name: "Clinic A",
    ownerUserId: USER_ID,
    ownerEmail: "pat@example.com",
    status: "active",
    subscriptionStatus: "active",
    plan: "organization",
    seatLimit: 10,
    activeSeatCount: 2,
    expiresAt: null,
    notes: null,
    createdByUserId: ADMIN_ID,
    revokedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function member(overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id: "m-1",
    workspaceId: WS_A,
    userId: USER_ID,
    email: "pat@example.com",
    role: "owner",
    status: "active",
    joinedAt: "2026-01-01T00:00:00.000Z",
    revokedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const admin = user({ id: ADMIN_ID, name: "Admin", email: "admin@example.com", role: "admin" });

describe("isSoleOwnerOfActiveWorkspace (admin users UI)", () => {
  it("is true only when no other owner identity remains", () => {
    assert.equal(
      isSoleOwnerOfActiveWorkspace({
        userId: USER_ID,
        email: "pat@example.com",
        workspace: { ownerUserId: USER_ID, ownerEmail: "pat@example.com" },
        ownerMembers: [{ userId: USER_ID, email: "pat@example.com" }],
      }),
      true,
    );
  });

  it("is false when another owner member exists", () => {
    assert.equal(
      isSoleOwnerOfActiveWorkspace({
        userId: USER_ID,
        email: "pat@example.com",
        workspace: { ownerUserId: USER_ID, ownerEmail: "pat@example.com" },
        ownerMembers: [
          { userId: USER_ID, email: "pat@example.com" },
          { userId: OTHER_ID, email: "other@example.com" },
        ],
      }),
      false,
    );
  });
});

describe("getUserDeactivateCapabilities sole-owner check", () => {
  it("blocks deactivation when the user is the only owner of an active workspace", () => {
    const result = getUserDeactivateCapabilities(user(), {
      currentUserId: ADMIN_ID,
      users: [admin, user()],
      workspaces: [workspace()],
      members: [member()],
    });
    assert.equal(result.canDeactivate, false);
    assert.match(result.blockedReason ?? "", /sole owner/i);
  });

  it("allows deactivation when another valid owner exists on that workspace", () => {
    const result = getUserDeactivateCapabilities(user(), {
      currentUserId: ADMIN_ID,
      users: [admin, user()],
      workspaces: [workspace()],
      members: [
        member(),
        member({
          id: "m-2",
          userId: OTHER_ID,
          email: "other@example.com",
          role: "owner",
          status: "active",
        }),
      ],
    });
    assert.equal(result.canDeactivate, true);
    assert.equal(result.blockedReason, null);
  });

  it("does not treat owning an active workspace as sole ownership when the listed owner is someone else", () => {
    const result = getUserDeactivateCapabilities(user(), {
      currentUserId: ADMIN_ID,
      users: [admin, user()],
      workspaces: [workspace({ ownerUserId: OTHER_ID, ownerEmail: "other@example.com" })],
      members: [
        member({ userId: OTHER_ID, email: "other@example.com", role: "owner" }),
        member({ id: "m-pat", role: "member" }),
      ],
    });
    assert.equal(result.canDeactivate, true);
  });

  it("ignores revoked owner members when deciding sole ownership", () => {
    const result = getUserDeactivateCapabilities(user(), {
      currentUserId: ADMIN_ID,
      users: [admin, user()],
      workspaces: [workspace()],
      members: [
        member(),
        member({
          id: "m-revoked",
          userId: OTHER_ID,
          email: "other@example.com",
          role: "owner",
          status: "revoked",
        }),
      ],
    });
    assert.equal(result.canDeactivate, false);
  });
});

describe("getUserPermanentDeleteCapabilities", () => {
  const context = {
    currentUserId: ADMIN_ID,
    workspaces: [] as Workspace[],
    members: [] as WorkspaceMember[],
  };

  it("allows Permanently Delete for a deactivated dummy user with no relationships", () => {
    const result = getUserPermanentDeleteCapabilities(user({ status: "disabled", hasAccess: false }), context);
    assert.equal(result.canPermanentlyDelete, true);
    assert.equal(result.blockedReason, null);
  });

  it("blocks the current user, platform admins, and accounts that are still active", () => {
    assert.match(
      getUserPermanentDeleteCapabilities(user({ id: ADMIN_ID, status: "disabled", hasAccess: false }), {
        ...context,
        currentUserId: ADMIN_ID,
      }).blockedReason ?? "",
      /your own account/i,
    );
    assert.match(
      getUserPermanentDeleteCapabilities(user({ role: "admin", status: "disabled", hasAccess: false }), context)
        .blockedReason ?? "",
      /Platform administrator/i,
    );
    assert.match(
      getUserPermanentDeleteCapabilities(user({ status: "active" }), context).blockedReason ?? "",
      /Deactivate the user/i,
    );
  });

  it("blocks workspace owners and remaining memberships", () => {
    const owner = getUserPermanentDeleteCapabilities(user({ status: "disabled", hasAccess: false }), {
      ...context,
      workspaces: [workspace({ status: "revoked" })],
    });
    assert.equal(owner.canPermanentlyDelete, false);
    assert.match(owner.blockedReason ?? "", /still owns a workspace/i);

    const remainingMember = getUserPermanentDeleteCapabilities(user({ status: "disabled", hasAccess: false }), {
      ...context,
      members: [member({ role: "member", status: "revoked" })],
    });
    assert.equal(remainingMember.canPermanentlyDelete, false);
    assert.match(remainingMember.blockedReason ?? "", /still belongs to one or more workspaces/i);
  });

  it("blocks Shopify-owned workspaces and visible billing access", () => {
    const shopify = getUserPermanentDeleteCapabilities(user({ status: "disabled", hasAccess: false }), {
      ...context,
      workspaces: [workspace({ billingSource: "shopify" })],
    });
    assert.match(shopify.blockedReason ?? "", /Shopify business relationship/i);

    const billing = getUserPermanentDeleteCapabilities(user({ status: "disabled", hasAccess: true }), context);
    assert.match(billing.blockedReason ?? "", /active billing/i);
  });

  it("does not change existing Deactivate capabilities", () => {
    const result = getUserDeactivateCapabilities(user(), {
      currentUserId: ADMIN_ID,
      users: [admin, user()],
      workspaces: [workspace({ ownerUserId: OTHER_ID, ownerEmail: "other@example.com" })],
      members: [member({ userId: OTHER_ID, email: "other@example.com", role: "owner" })],
    });
    assert.equal(result.canDeactivate, true);
  });
});

describe("user permanent-delete type-to-confirm", () => {
  it("keeps the Permanently Delete button disabled for empty or wrong values", () => {
    assert.equal(confirmationMatches("", "pat@example.com", "email"), false);
    assert.equal(confirmationMatches("wrong@example.com", "pat@example.com", "email"), false);
  });

  it("enables the button only for the exact user email", () => {
    assert.equal(confirmationMatches("pat@example.com", "pat@example.com", "email"), true);
    assert.equal(confirmationMatches("  Pat@Example.com  ", "pat@example.com", "email"), true);
  });
});
