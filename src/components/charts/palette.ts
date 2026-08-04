/**
 * Chart palette for the HealthAge admin console.
 *
 * ============================== HOW THIS WAS DERIVED =========================
 * Colours are not hand-picked. Each slot does exactly one job (identity /
 * magnitude / state) and the categorical set was machine-validated against the
 * chart surface actually used here (`--card` = #ffffff) for:
 *
 *   lightness band · chroma floor · CVD separation (protan/deutan, ΔE OKLab×100)
 *   · normal-vision separation floor · contrast vs surface
 *
 * Validated result (light, surface #ffffff):
 *   slots 1–3, all-pairs : worst CVD ΔE 12.5, worst normal-vision ΔE 24.3 — PASS
 *   slots 1–4, adjacent  : worst CVD ΔE 11.6, worst normal-vision ΔE 19.8 — PASS
 *
 * Only adjacent-mark forms are used here (stacked bars, donut rings, lines), so
 * the adjacent pairlist is the governing test. No scatter/bubble/choropleth
 * exists in this dashboard; if one is added, cap it at the first three slots.
 *
 * The brand accent `--accent` (#0f766e) is deliberately NOT slot 1: its OKLCH
 * chroma is 0.086, below the 0.10 floor, so it reads grey as a data fill. Slot 1
 * is the next step of the same teal hue (#0d9488), which clears the floor while
 * staying unmistakably the brand colour. This is the standard "snap to the
 * nearest passing step" adjustment — hue preserved, lightness moved.
 *
 * The app ships a single (light) theme; every value below is validated against
 * the light surface only. If a dark theme is introduced, re-step these against
 * the dark surface rather than flipping them automatically.
 */

/** Categorical identity. Assigned in fixed order, never cycled, never by rank. */
export const categoricalPalette = ["#0d9488", "#d97706", "#7c3aed", "#be185d"] as const;

export const CATEGORICAL_LIMIT = categoricalPalette.length;

/**
 * Colour follows the entity, not its row number: callers pass a stable index
 * derived from the entity's position in a fixed key order, so filtering a series
 * out never repaints the survivors.
 */
export function categoricalColor(index: number): string {
  return categoricalPalette[index % categoricalPalette.length];
}

/**
 * Reserved status scale. Never used for "series N" — a status colour must always
 * mean the state it names, and always ships beside an icon or a text label so
 * meaning is never carried by hue alone.
 *
 * Every value is an existing design token, and every one clears 3:1 on white.
 */
export const statusPalette = {
  good: "#059669", // --success            3.77:1
  info: "#0369a1", // --info               5.93:1
  warning: "#b45309", // --warning         5.02:1
  critical: "#dc2626", // --danger         4.83:1
  neutral: "#64748b", // --text-muted      4.76:1
} as const;

export type StatusTone = keyof typeof statusPalette;

export function statusColor(tone: StatusTone | null | undefined, fallbackIndex = 0): string {
  if (!tone) return categoricalColor(fallbackIndex);
  return statusPalette[tone];
}

/** Chart chrome, mapped to the existing design tokens so charts age with the UI. */
export const chartInk = {
  surface: "var(--card)",
  grid: "var(--border)",
  axis: "var(--border-strong)",
  label: "var(--text-muted)",
  subtle: "var(--text-subtle)",
  strong: "var(--foreground)",
} as const;

/** Area fills are a wash, never a saturated block. */
export const AREA_FILL_OPACITY = 0.1;

/** Negative space that separates touching marks, in px. */
export const SURFACE_GAP = 2;
