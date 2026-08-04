/**
 * CSV export for the Analytics dashboard.
 *
 * Exports exactly what is on screen — the same derived figures, over the same
 * date range and the same member coverage. Unavailable figures are exported as
 * an empty cell plus a reason, never as a zero, so a spreadsheet cannot imply a
 * measurement that was never taken.
 */

export type CsvCell = string | number | null;

export type CsvSection = {
  title: string;
  headers: string[];
  rows: CsvCell[][];
};

/**
 * Values beginning with these characters are interpreted as formulas by Excel,
 * Sheets, and Numbers. Prefixing with a quote neutralises them without changing
 * what the reader sees.
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";

  const safe = neutralizeFormula(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(sections: CsvSection[]): string {
  const lines: string[] = [];

  sections.forEach((section, index) => {
    if (index > 0) lines.push("");
    lines.push(escapeCell(section.title));
    lines.push(section.headers.map(escapeCell).join(","));
    for (const row of section.rows) {
      lines.push(row.map(escapeCell).join(","));
    }
  });

  return lines.join("\r\n");
}

/** Slug safe for a filename on every platform. */
export function csvFilename(prefix: string, now: Date = new Date()): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return `${prefix}-${stamp}.csv`;
}

/** True when the browser can produce a download; the UI hides export otherwise. */
export function canExportCsv(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function" &&
    typeof document !== "undefined"
  );
}

export function downloadCsv(filename: string, content: string): boolean {
  if (!canExportCsv()) return false;

  try {
    // BOM so Excel opens UTF-8 content (workspace names, emails) correctly.
    const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoke on the next frame so Safari has time to start the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}
