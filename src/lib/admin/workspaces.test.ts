import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { confirmationMatches } from "./confirmation";
import { getWorkspacePermanentDeleteCapabilities, isShopifyManagedWorkspace } from "./workspaces";
import type { Workspace } from "@/types/admin";

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Test workspace",
    ownerUserId: null,
    ownerEmail: "owner@example.com",
    status: "active",
    subscriptionStatus: "active",
    plan: "organization",
    seatLimit: 10,
    activeSeatCount: 1,
    expiresAt: null,
    notes: null,
    createdByUserId: null,
    revokedAt: null,
    billingSource: "manual",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("confirmationMatches", () => {
  it("keeps the Permanently Delete button disabled for empty or wrong values", () => {
    assert.equal(confirmationMatches("", "Test workspace", "exact"), false);
    assert.equal(confirmationMatches("Wrong", "Test workspace", "exact"), false);
    assert.equal(confirmationMatches("test workspace", "Test workspace", "exact"), false);
  });

  it("enables the button only for the exact workspace name", () => {
    assert.equal(confirmationMatches("Test workspace", "Test workspace", "exact"), true);
    assert.equal(confirmationMatches("  Test workspace  ", "Test workspace", "exact"), true);
  });

  it("does not change member email matching (case-insensitive)", () => {
    assert.equal(confirmationMatches("Pat@Example.com", "pat@example.com", "email"), true);
  });
});

describe("getWorkspacePermanentDeleteCapabilities", () => {
  it("allows Permanently Delete for an eligible manual workspace", () => {
    const result = getWorkspacePermanentDeleteCapabilities(workspace());
    assert.equal(result.canPermanentlyDelete, true);
    assert.equal(result.blockedReason, null);
  });

  it("blocks Shopify-managed workspaces", () => {
    const result = getWorkspacePermanentDeleteCapabilities(workspace({ billingSource: "shopify" }));
    assert.equal(result.canPermanentlyDelete, false);
    assert.match(result.blockedReason ?? "", /Shopify-managed/i);
    assert.equal(isShopifyManagedWorkspace(workspace({ billingSource: "shopify" })), true);
  });
});
