"use client";

import { FormEvent, useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateField } from "@/components/ui/DateField";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import {
  clearFieldError,
  describedBy,
  focusFirstInvalidField,
  subscriptionStatusLabels,
  subscriptionStatusOptions,
  workspaceStatusLabels,
  workspaceStatusOptions,
} from "@/lib/admin/workspaceForm";
import {
  validateWorkspaceUpdateDraft,
  workspaceUpdateValues,
  type WorkspaceFormErrors,
} from "@/lib/admin/workspaces";
import type { Workspace } from "@/types/admin";

/**
 * The Update Organization form, in a modal opened from a directory row.
 *
 * It used to sit permanently above the directory, which made the page long and
 * duplicated actions that the row menu already offered. The form itself is
 * unchanged — same fields, same validation, same submit handler on the owning
 * page, which still builds and sends exactly the request it always did.
 *
 * Values are hydrated by the page from the selected workspace; this component
 * only reads them, so a background refresh cannot clobber an edit in progress.
 */

type WorkspaceUpdateDialogProps = {
  open: boolean;
  /** The workspace being edited; also the baseline for the unsaved-changes check. */
  workspace: Workspace | null;
  isBusy: boolean;
  /** Dismisses the dialog for real — the discard prompt is handled in here. */
  onClose: () => void;
  updateSeatLimit: string;
  setUpdateSeatLimit: (value: string) => void;
  updatePlan: string;
  setUpdatePlan: (value: string) => void;
  updateSubscriptionStatus: string;
  setUpdateSubscriptionStatus: (value: string) => void;
  updateStatus: string;
  setUpdateStatus: (value: string) => void;
  updateNotes: string;
  setUpdateNotes: (value: string) => void;
  updateExpiresAt: string;
  setUpdateExpiresAt: (value: string) => void;
  /** Resolves true when the workspace was saved, false when the request failed. */
  onUpdateWorkspace: (event: FormEvent<HTMLFormElement>) => Promise<boolean>;
};

const formId = "ws-update-form";

const fieldIds = {
  seatLimit: "ws-update-seats",
  plan: "ws-update-plan",
  expiresAt: "ws-update-expires",
  notes: "ws-update-notes",
};

export function WorkspaceUpdateDialog(props: WorkspaceUpdateDialogProps) {
  const { open, workspace, isBusy, onClose } = props;

  const [errors, setErrors] = useState<WorkspaceFormErrors>({});
  const [isDiscardPromptOpen, setIsDiscardPromptOpen] = useState(false);

  // A fresh opening, or a different organization, starts with a clean slate.
  useEffect(() => {
    setErrors({});
    setIsDiscardPromptOpen(false);
  }, [open, workspace?.id]);

  const saved = workspace ? workspaceUpdateValues(workspace) : null;

  /** True once any field differs from what is stored on the workspace. */
  const isDirty =
    saved !== null &&
    (saved.seatLimit !== props.updateSeatLimit ||
      saved.plan !== props.updatePlan ||
      saved.subscriptionStatus !== props.updateSubscriptionStatus ||
      saved.status !== props.updateStatus ||
      saved.notes !== props.updateNotes ||
      saved.expiresAt !== props.updateExpiresAt);

  /** Puts every field back to the stored record, so a reopen starts clean. */
  function resetToSaved(): void {
    if (!saved) return;
    props.setUpdateSeatLimit(saved.seatLimit);
    props.setUpdatePlan(saved.plan);
    props.setUpdateSubscriptionStatus(saved.subscriptionStatus);
    props.setUpdateStatus(saved.status);
    props.setUpdateNotes(saved.notes);
    props.setUpdateExpiresAt(saved.expiresAt);
  }

  /** Every exit route lands here: close button, backdrop, Escape, Cancel. */
  function requestClose(): void {
    if (isBusy) return;
    if (isDirty) {
      setIsDiscardPromptOpen(true);
      return;
    }
    onClose();
  }

  function discardAndClose(): void {
    setIsDiscardPromptOpen(false);
    resetToSaved();
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const nextErrors = validateWorkspaceUpdateDraft({
      seatLimit: props.updateSeatLimit,
      plan: props.updatePlan,
      expiresAt: props.updateExpiresAt,
      notes: props.updateNotes,
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField(nextErrors, fieldIds);
      return;
    }

    // The page owns the request; it reports back whether the save landed.
    if (await props.onUpdateWorkspace(event)) onClose();
  }

  return (
    <>
      <Modal
        open={open && workspace !== null}
        onClose={requestClose}
        title="Update Organization"
        subtitle="Change licenses, subscription details, expiry date, or organization access."
        closeLabel="Close update organization dialog"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={requestClose} disabled={isBusy} className="ha-btn ha-btn-secondary">
              Cancel
            </button>
            <button type="submit" form={formId} disabled={isBusy} className="ha-btn ha-btn-primary">
              <Icon name="check" size={14} />
              {isBusy ? "Working…" : "Save Changes"}
            </button>
          </div>
        }
      >
        {workspace ? (
          <>
            {/* Context, not inputs: the API call this form makes never carries
                the name or the owner, so they are shown read-only. */}
            <dl className="mb-4 grid gap-3 rounded-lg bg-[color:var(--muted)] px-3.5 py-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="ha-label mb-0.5">Organization Name</dt>
                <dd className="truncate text-[0.8125rem] font-medium text-[color:var(--foreground)]">
                  {workspace.name}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="ha-label mb-0.5">Organization Administrator Email</dt>
                <dd className="truncate text-[0.8125rem] font-medium text-[color:var(--foreground)]">
                  {workspace.ownerEmail}
                </dd>
              </div>
            </dl>

            {/* `noValidate` hands validation to our own friendly messages instead
                of the browser's generic "Please fill out this field" bubble. */}
            <form id={formId} className="grid gap-3.5" noValidate onSubmit={(event) => void handleSubmit(event)}>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="ha-label" htmlFor={fieldIds.seatLimit}>
                    Number of Licenses
                  </label>
                  <input
                    id={fieldIds.seatLimit}
                    value={props.updateSeatLimit}
                    onChange={(e) => {
                      props.setUpdateSeatLimit(e.target.value);
                      clearFieldError(setErrors, "seatLimit");
                    }}
                    className="ha-input"
                    placeholder="10"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    aria-invalid={errors.seatLimit ? true : undefined}
                    aria-describedby={describedBy(
                      "ws-update-seats-hint",
                      errors.seatLimit && "ws-update-seats-error",
                    )}
                  />
                  <p id="ws-update-seats-hint" className="ha-hint">
                    Maximum number of users allowed in this organization.
                  </p>
                  {errors.seatLimit ? (
                    <p id="ws-update-seats-error" role="alert" className="ha-error-text">
                      {errors.seatLimit}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="ha-label" htmlFor={fieldIds.plan}>
                    License Type
                  </label>
                  <input
                    id={fieldIds.plan}
                    value={props.updatePlan}
                    onChange={(e) => {
                      props.setUpdatePlan(e.target.value);
                      clearFieldError(setErrors, "plan");
                    }}
                    className="ha-input"
                    placeholder="organization"
                    maxLength={100}
                    aria-invalid={errors.plan ? true : undefined}
                    aria-describedby={describedBy("ws-update-plan-hint", errors.plan && "ws-update-plan-error")}
                  />
                  <p id="ws-update-plan-hint" className="ha-hint">
                    The plan this organization is billed on.
                  </p>
                  {errors.plan ? (
                    <p id="ws-update-plan-error" role="alert" className="ha-error-text">
                      {errors.plan}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="ha-label" htmlFor="ws-update-sub">
                    Subscription Status
                  </label>
                  <select
                    id="ws-update-sub"
                    value={props.updateSubscriptionStatus}
                    onChange={(e) => props.setUpdateSubscriptionStatus(e.target.value)}
                    className="ha-input"
                  >
                    {subscriptionStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {subscriptionStatusLabels[option] ?? option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="ha-label" htmlFor="ws-update-status">
                    Organization Status
                  </label>
                  <select
                    id="ws-update-status"
                    value={props.updateStatus}
                    onChange={(e) => props.setUpdateStatus(e.target.value)}
                    className="ha-input"
                  >
                    {workspaceStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {workspaceStatusLabels[option] ?? option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="ha-label" htmlFor={fieldIds.expiresAt}>
                  Subscription Expiry Date
                </label>
                <DateField
                  id={fieldIds.expiresAt}
                  label="Subscription expiry date"
                  value={props.updateExpiresAt}
                  onChange={(value) => {
                    props.setUpdateExpiresAt(value);
                    clearFieldError(setErrors, "expiresAt");
                  }}
                  placeholder="Select a date"
                  invalid={Boolean(errors.expiresAt)}
                  describedBy={describedBy(
                    "ws-update-expires-hint",
                    errors.expiresAt && "ws-update-expires-error",
                  )}
                />
                <p id="ws-update-expires-hint" className="ha-hint">
                  The day access ends. Clear it for a subscription that does not expire.
                </p>
                {errors.expiresAt ? (
                  <p id="ws-update-expires-error" role="alert" className="ha-error-text">
                    {errors.expiresAt}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="ha-label" htmlFor={fieldIds.notes}>
                  Internal Notes
                </label>
                <input
                  id={fieldIds.notes}
                  value={props.updateNotes}
                  onChange={(e) => {
                    props.setUpdateNotes(e.target.value);
                    clearFieldError(setErrors, "notes");
                  }}
                  className="ha-input"
                  placeholder="Annual subscription renewed."
                  maxLength={1000}
                  aria-invalid={errors.notes ? true : undefined}
                  aria-describedby={describedBy("ws-update-notes-hint", errors.notes && "ws-update-notes-error")}
                />
                <p id="ws-update-notes-hint" className="ha-hint">
                  Only visible to platform administrators.
                </p>
                {errors.notes ? (
                  <p id="ws-update-notes-error" role="alert" className="ha-error-text">
                    {errors.notes}
                  </p>
                ) : null}
              </div>
            </form>
          </>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={isDiscardPromptOpen}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to close?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={discardAndClose}
        onCancel={() => setIsDiscardPromptOpen(false)}
      />
    </>
  );
}
