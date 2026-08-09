"use client";

import type { Dispatch, SetStateAction } from "react";

import type { WorkspaceFormErrors, WorkspaceFormField } from "@/lib/admin/workspaces";

/**
 * Presentation vocabulary shared by the two workspace forms — the create card on
 * the Workspaces page and the update dialog behind each row's action menu.
 *
 * It lives here rather than in either component so the two cannot drift apart:
 * the same status wording, the same error plumbing, the same field order.
 * Validation itself stays in `workspaces.ts`; this file only decides how the
 * result is worded and where the caret lands.
 */

export const subscriptionStatusOptions = ["active", "trialing", "past_due", "expired", "canceled"];
export const workspaceStatusOptions = ["active", "suspended", "revoked"];

/**
 * Readable names for the two status vocabularies. Labels only — the values
 * submitted to the API remain the backend enums verbatim.
 */
export const subscriptionStatusLabels: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment overdue",
  expired: "Expired",
  canceled: "Canceled",
};

export const workspaceStatusLabels: Record<string, string> = {
  active: "Active",
  suspended: "Suspended",
  revoked: "Revoked",
};

/**
 * Field order for error focus. Submitting an invalid form should land the caret
 * on the first thing that needs fixing, not leave the admin hunting for red text.
 */
const formFieldOrder: WorkspaceFormField[] = ["name", "ownerEmail", "seatLimit", "plan", "expiresAt", "notes"];

export function focusFirstInvalidField(
  errors: WorkspaceFormErrors,
  ids: Partial<Record<WorkspaceFormField, string>>,
): void {
  const field = formFieldOrder.find((key) => errors[key]);
  const id = field ? ids[field] : undefined;
  if (id) document.getElementById(id)?.focus();
}

/** Joins the ids of the hint and error paragraphs that describe one field. */
export function describedBy(...ids: Array<string | false | undefined>): string | undefined {
  return ids.filter(Boolean).join(" ") || undefined;
}

/** Drops a field's error as soon as the admin starts correcting it. */
export function clearFieldError(
  setErrors: Dispatch<SetStateAction<WorkspaceFormErrors>>,
  field: WorkspaceFormField,
): void {
  setErrors((current) => {
    if (!current[field]) return current;
    const next = { ...current };
    delete next[field];
    return next;
  });
}
