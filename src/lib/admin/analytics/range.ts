/**
 * Date-range presets and time bucketing for the Analytics dashboard.
 *
 * Everything here is pure and client-side: the backend exposes no analytics or
 * time-series endpoint, so ranges are applied to the record timestamps that the
 * existing endpoints already return (`createdAt`, `joinedAt`, `revokedAt`, …).
 *
 * Day boundaries are local-time, matching how an administrator reads "today".
 */

export const DAY_MS = 86_400_000;

export type RangeKey = "7d" | "30d" | "90d" | "all";

export const rangeOptions: ReadonlyArray<{ value: RangeKey; label: string; short: string }> = [
  { value: "7d", label: "Last 7 days", short: "7D" },
  { value: "30d", label: "Last 30 days", short: "30D" },
  { value: "90d", label: "Last 90 days", short: "90D" },
  { value: "all", label: "All time", short: "All" },
];

export function isRangeKey(value: unknown): value is RangeKey {
  return value === "7d" || value === "30d" || value === "90d" || value === "all";
}

export type DateRange = {
  key: RangeKey;
  label: string;
  /** Whole days covered, or null for all time. */
  days: number | null;
  /** Inclusive lower bound in epoch ms; null means unbounded (all time). */
  since: number | null;
  /** Exclusive upper bound — always "now". */
  until: number;
};

export function startOfDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function buildDateRange(key: RangeKey, now: number): DateRange {
  if (key === "all") {
    return { key, label: "All time", days: null, since: null, until: now };
  }
  const days = key === "7d" ? 7 : key === "30d" ? 30 : 90;
  // `days` buckets ending with today, so the window starts (days - 1) days back.
  return {
    key,
    label: `Last ${days} days`,
    days,
    since: startOfDay(now) - (days - 1) * DAY_MS,
    until: now,
  };
}

/**
 * The equally sized window immediately before `range`, used for period-over-period
 * deltas. Null for all-time, which has no comparable prior period.
 */
export function previousWindow(range: DateRange): { since: number; until: number } | null {
  if (range.since === null || range.days === null) return null;
  const span = range.days * DAY_MS;
  return { since: range.since - span, until: range.since };
}

/** Epoch ms, or null when the value is missing or unparseable. */
export function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isWithin(time: number, since: number | null, until: number): boolean {
  if (time > until) return false;
  return since === null || time >= since;
}

/* --------------------------------------------------------------- bucketing */

export type Granularity = "day" | "week" | "month";

export type Bucket = {
  key: string;
  start: number;
  /** Exclusive. */
  end: number;
  label: string;
  /** Full label for tooltips and the table view. */
  longLabel: string;
};

const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const longDayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const monthFormat = new Intl.DateTimeFormat(undefined, { month: "short" });
const longMonthFormat = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

function addMonths(time: number, count: number): number {
  const date = new Date(time);
  date.setMonth(date.getMonth() + count);
  return date.getTime();
}

function startOfMonth(time: number): number {
  const date = new Date(time);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Granularity that keeps a range readable: never more than ~30 columns. */
export function pickGranularity(spanDays: number): Granularity {
  if (spanDays <= 31) return "day";
  if (spanDays <= 182) return "week";
  return "month";
}

/**
 * Contiguous buckets covering the range.
 *
 * For all-time the span is derived from `earliest` — the oldest real timestamp in
 * the data — so the axis never invents empty history. Returns `[]` when there is
 * nothing to plot, which callers surface as an empty state rather than a flat line.
 */
export function buildBuckets(range: DateRange, now: number, earliest: number | null): Bucket[] {
  const rangeStart = range.since ?? earliest;
  if (rangeStart === null) return [];

  const spanDays = Math.max(1, Math.ceil((now - rangeStart) / DAY_MS) + 1);
  const granularity = range.days !== null ? pickGranularity(range.days) : pickGranularity(spanDays);
  const buckets: Bucket[] = [];

  if (granularity === "month") {
    let cursor = startOfMonth(rangeStart);
    const last = startOfMonth(now);
    while (cursor <= last && buckets.length < 60) {
      const end = addMonths(cursor, 1);
      buckets.push({
        key: `m-${cursor}`,
        start: cursor,
        end,
        label: monthFormat.format(cursor),
        longLabel: longMonthFormat.format(cursor),
      });
      cursor = end;
    }
    return buckets;
  }

  const step = granularity === "week" ? 7 * DAY_MS : DAY_MS;
  const endOfToday = startOfDay(now) + DAY_MS;
  // Align the final bucket to today so "last 7 days" ends on today, not a stale edge.
  let cursor = startOfDay(rangeStart);
  while (cursor < endOfToday && buckets.length < 60) {
    const end = Math.min(cursor + step, endOfToday);
    buckets.push({
      key: `${granularity}-${cursor}`,
      start: cursor,
      end,
      label: dayFormat.format(cursor),
      longLabel:
        granularity === "week"
          ? `Week of ${longDayFormat.format(cursor)}`
          : longDayFormat.format(cursor),
    });
    cursor += step;
  }

  return buckets;
}

/** Counts per bucket. `times` may be unsorted; it is not mutated. */
export function countInBuckets(times: number[], buckets: Bucket[]): number[] {
  const counts = new Array<number>(buckets.length).fill(0);
  if (buckets.length === 0) return counts;

  const sorted = [...times].sort((a, b) => a - b);
  let index = 0;

  for (const time of sorted) {
    while (index < buckets.length && time >= buckets[index].end) index += 1;
    if (index >= buckets.length) break;
    if (time >= buckets[index].start) counts[index] += 1;
  }

  return counts;
}

/** Running total, seeded with everything that already existed before bucket 0. */
export function cumulativeFrom(baseline: number, counts: number[]): number[] {
  let total = baseline;
  return counts.map((count) => {
    total += count;
    return total;
  });
}

export function countBefore(times: number[], boundary: number): number {
  let count = 0;
  for (const time of times) if (time < boundary) count += 1;
  return count;
}

export function countWithin(times: number[], since: number | null, until: number): number {
  let count = 0;
  for (const time of times) if (isWithin(time, since, until)) count += 1;
  return count;
}
