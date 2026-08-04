/**
 * Maps the backend's status vocabularies onto a consistent badge treatment.
 *
 * Values come from workspaces (`status`, `subscriptionStatus`), workspace
 * members (`status`), and users (`status`). Unknown values fall back to neutral
 * rather than being hidden, so new backend statuses stay visible.
 */

const successValues = new Set(["active", "fulfilled", "granted", "yes"]);
const warningValues = new Set(["trialing", "invited", "pending", "past_due", "paused", "suspended"]);
const dangerValues = new Set(["revoked", "expired", "canceled", "cancelled", "refunded", "no", "none"]);

function toneFor(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (successValues.has(normalized)) return "ha-badge-success";
  if (warningValues.has(normalized)) return "ha-badge-warning";
  if (dangerValues.has(normalized)) return "ha-badge-danger";
  return "ha-badge-neutral";
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="ha-badge ha-badge-neutral">—</span>;
  return <span className={`ha-badge ${toneFor(value)}`}>{value}</span>;
}

/** Role chips read as identity, not health, so they stay visually quiet. */
export function RoleBadge({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase();
  const tone = normalized === "owner" ? "ha-badge-info" : normalized === "admin" ? "ha-badge-warning" : "ha-badge-neutral";
  return <span className={`ha-badge ${tone}`}>{value}</span>;
}
