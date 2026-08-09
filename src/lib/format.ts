/**
 * Shared value formatting.
 *
 * Two date shapes travel through the admin UI, and mixing them up is the
 * classic off-by-one-day bug, so they are named apart everywhere:
 *
 * - an **ISO instant** — `2026-12-31T00:00:00.000Z` — is what the API stores
 *   and returns;
 * - a **calendar date** — `2026-12-31` — is what a person picks in the date
 *   picker, and carries no time and no timezone at all.
 *
 * Subscription expiry is a calendar date that the API happens to keep as an
 * instant at UTC midnight. Reading it back in the browser's local zone would
 * roll it to the previous day anywhere west of Greenwich, so every conversion
 * below reads and writes the UTC components instead — the day an admin picks
 * is the day that comes back.
 */

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Pinned to en-GB rather than the viewer's locale so the friendly form is
 * always the unambiguous `31 Dec 2026`, never `12/31/2026` or `31/12/2026`.
 */
const friendlyDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

/** True when `value` is a well-formed `YYYY-MM-DD` day that actually exists. */
export function isCalendarDate(value: string): boolean {
  if (!calendarDatePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  // `2026-02-31` parses happily and rolls into March, so compare the parsed
  // day back against the input rather than trusting the parse.
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}` === value;
}

/** `2026-12-31` → `31 Dec 2026`. Empty string for anything unparseable. */
export function formatCalendarDate(value: string): string {
  if (!isCalendarDate(value)) return "";
  return friendlyDateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

/** ISO instant → `31 Dec 2026`. Empty string for anything unparseable. */
export function formatFriendlyDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return friendlyDateFormatter.format(date);
}

/** API instant → picker value. Empty string when nothing is set. */
export function isoToCalendarDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Picker value → the ISO instant the API already expects. Null when unset. */
export function calendarDateToIso(value: string): string | null {
  if (!isCalendarDate(value)) return null;
  return `${value}T00:00:00.000Z`;
}

/** Today in the viewer's own timezone — what "today" means to a person. */
export function todayCalendarDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
