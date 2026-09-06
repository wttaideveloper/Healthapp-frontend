export type ConfirmationMatchMode = "email" | "exact";

/**
 * Type-to-confirm matching used by ConfirmDialog.
 *
 * `email` follows the backend member-delete convention (trim + lowercase).
 * `exact` follows workspace-name confirmation (trim only, case-sensitive).
 */
export function confirmationMatches(
  typed: string,
  expected: string,
  mode: ConfirmationMatchMode = "email",
): boolean {
  if (mode === "exact") {
    return typed.trim() === expected.trim();
  }
  return typed.trim().toLowerCase() === expected.trim().toLowerCase();
}
