import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMemberPermanentDeleteCapabilities, isLastOwnerEquivalentSeat } from "./members";
import type { Workspace, WorkspaceMember } from "@/types/admin";

const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OWNER_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const WS_A = "11111111-1111-1111-1111-111111111111";

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: WS_A,
    name: "Clinic A",
    ownerUserId: OWNER_ID,
    ownerEmail: "owner@example.com",
    status: "active",
    subscriptionStatus: "active",
    plan: "organization",
    seatLimit: 10,
    activeSeatCount: 2,
    expiresAt: null,
    notes: null,
    createdByUserId: null,
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
    role: "member",
    status: "active",
    joinedAt: "2026-01-01T00:00:00.000Z",
    revokedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const ownerSeat = member({
  id: "m-owner",
  userId: OWNER_ID,
  email: "owner@example.com",
  role: "owner",
});

describe("getMemberPermanentDeleteCapabilities", () => {
  it("allows a platform admin to delete a dummy member", () => {
    const result = getMemberPermanentDeleteCapabilities(member(), true, workspace(), [ownerSeat, member()]);
    assert.equal(result.canPermanentlyDelete, true);
    assert.equal(result.blockedReason, null);
  });

  it("hides the action from workspace admins", () => {
    const result = getMemberPermanentDeleteCapabilities(member(), false, workspace(), [ownerSeat, member()]);
    assert.equal(result.canPermanentlyDelete, false);
    assert.match(result.blockedReason ?? "", /platform admin/i);
  });

  it("blocks owner rows", () => {
    const result = getMemberPermanentDeleteCapabilities(ownerSeat, true, workspace(), [ownerSeat]);
    assert.equal(result.canPermanentlyDelete, false);
    assert.match(result.blockedReason ?? "", /owner/i);
  });

  it("blocks the last remaining owner-equivalent seat", () => {
    const listedOwnerAsAdmin = member({
      userId: OWNER_ID,
      email: "owner@example.com",
      role: "admin",
    });
    const result = getMemberPermanentDeleteCapabilities(listedOwnerAsAdmin, true, workspace(), [listedOwnerAsAdmin]);
    assert.equal(result.canPermanentlyDelete, false);
    assert.match(result.blockedReason ?? "", /last remaining owner-equivalent/i);
  });
});

describe("isLastOwnerEquivalentSeat (admin members UI)", () => {
  it("is false for a regular member when an owner remains", () => {
    assert.equal(
      isLastOwnerEquivalentSeat({
        member: member(),
        workspace: { ownerUserId: OWNER_ID, ownerEmail: "owner@example.com" },
        ownerSeats: [{ userId: OWNER_ID, email: "owner@example.com" }],
      }),
      false,
    );
  });
});
