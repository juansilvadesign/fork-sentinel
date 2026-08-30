import { summarisePrs } from "./prs.ts";
import type { DriftStatus, Report, ReportRow } from "./types.ts";

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
} as const;

export interface RenderOptions {
  color?: boolean;
  /** Include bookmark rows (forks with no commits of your own). */
  all?: boolean;
}

const STATUS_LABEL: Record<DriftStatus, string> = {
  diverged: "DIVERGED",
  clean: "clean",
  bookmark: "bookmark",
  orphaned: "orphaned",
  unrelated: "unrelated",
  unknown: "unknown",
};

const STATUS_COLOR: Record<DriftStatus, keyof typeof ANSI> = {
  diverged: "red",
  clean: "green",
  bookmark: "dim",
  orphaned: "yellow",
  unrelated: "dim",
  unknown: "yellow",
};

function paint(text: string, color: keyof typeof ANSI, enabled: boolean): string {
  return enabled ? `${ANSI[color]}${text}${ANSI.reset}` : text;
}

/**
 * Rows worth showing by default.
 *
 * Hidden: bookmarks (no work of your own) and the two *explained* dead ends —
 * a deleted upstream and an unrelated history. Both are permanent facts, not
 * drift, and neither is actionable. `unknown` deliberately stays visible: it
 * means the tool failed rather than that the fork is fine, and hiding that
 * would let a broken run read as a clean one.
 */
const HIDDEN_BY_DEFAULT = new Set<DriftStatus>(["bookmark", "orphaned", "unrelated"]);

export function visibleRows(rows: readonly ReportRow[], all: boolean): ReportRow[] {
  return all ? [...rows] : rows.filter((r) => !HIDDEN_BY_DEFAULT.has(r.drift.status));
}

/** Counts of what the default view is not showing, so nothing vanishes silently. */
export function hiddenSummary(rows: readonly ReportRow[]): string | null {
  const counts = new Map<DriftStatus, number>();
  for (const r of rows) {
    if (HIDDEN_BY_DEFAULT.has(r.drift.status)) {
      counts.set(r.drift.status, (counts.get(r.drift.status) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return null;

  const label: Partial<Record<DriftStatus, string>> = {
    bookmark: "never patched",
    orphaned: "upstream deleted",
    unrelated: "unrelated history",
  };
  const parts = [...counts.entries()].map(([status, n]) => `${n} ${label[status] ?? status}`);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return `${total} fork${total === 1 ? "" : "s"} not shown: ${parts.join(" · ")} (--all to list)`;
}

export function renderTable(report: Report, opts: RenderOptions = {}): string {
  const color = opts.color ?? false;
  const rows = visibleRows(report.rows, opts.all ?? false);
  const out: string[] = [];

  out.push(
    paint("fork-sentinel", "bold", color) +
      ` · ${report.user} · ${report.scanned} of ${report.totalForks} forks scanned`,
  );
  out.push("");

  if (rows.length === 0) {
    out.push("  No maintained forks found - every fork is even with its upstream.");
    out.push(paint("  (run with --all to list bookmark forks too)", "dim", color));
    return out.join("\n");
  }

  const header = ["FORK", "UPSTREAM", "AHEAD", "BEHIND", "STATUS", "OUTBOUND PRS"];
  const body = rows.map((r) => [
    r.drift.fork.name,
    r.drift.fork.parentFullName ?? "-",
    String(r.drift.ahead),
    String(r.drift.behind),
    STATUS_LABEL[r.drift.status],
    summarisePrs(r.prs),
  ]);

  const widths = header.map((h, i) =>
    Math.max(h.length, ...body.map((row) => (row[i] ?? "").length)),
  );

  const line = (cells: string[], colorise?: (i: number) => keyof typeof ANSI | null) =>
    cells
      .map((cell, i) => {
        const padded = cell.padEnd(widths[i] ?? 0);
        const c = colorise?.(i);
        return c ? paint(padded, c, color) : padded;
      })
      .join("  ")
      .trimEnd();

  out.push(paint(line(header), "dim", color));

  for (const [index, cells] of body.entries()) {
    const row = rows[index]!;
    out.push(line(cells, (i) => (i === 4 ? STATUS_COLOR[row.drift.status] : null)));
    if (row.drift.note) {
      out.push(paint(`    -> ${row.drift.note}`, "dim", color));
    }
  }

  const diverged = rows.filter((r) => r.drift.status === "diverged");
  out.push("");
  if (diverged.length > 0) {
    out.push(
      paint(
        `${diverged.length} fork${diverged.length === 1 ? "" : "s"} diverged - upstream moved under patches you wrote:`,
        "bold",
        color,
      ),
    );
    for (const r of diverged) {
      out.push(
        `  ${paint(r.drift.fork.name, "cyan", color)} is ${r.drift.behind} behind ${r.drift.fork.parentFullName}`,
      );
      out.push(
        paint(
          `    git -C <path> fetch upstream && git -C <path> log --oneline ${r.drift.branch}..upstream/${r.drift.fork.parentDefaultBranch}`,
          "dim",
          color,
        ),
      );
    }
  } else {
    out.push(paint("No diverged forks. Everything you maintain is current.", "green", color));
  }

  if (!opts.all) {
    const hidden = hiddenSummary(report.rows);
    if (hidden) out.push(paint(hidden, "dim", color));
  }

  return out.join("\n");
}

export function renderJson(report: Report, opts: RenderOptions = {}): string {
  return JSON.stringify({ ...report, rows: visibleRows(report.rows, opts.all ?? false) }, null, 2);
}
