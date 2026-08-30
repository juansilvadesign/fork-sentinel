import { describe, expect, test } from "bun:test";
import { hiddenSummary, renderJson, renderTable, visibleRows } from "../src/render.ts";
import { summarisePrs } from "../src/prs.ts";
import type { Report, ReportRow } from "../src/types.ts";
import { fork } from "./helpers.ts";

function row(name: string, status: ReportRow["drift"]["status"], ahead: number, behind: number): ReportRow {
  return {
    drift: {
      fork: fork({ name, fullName: `me/${name}`, parentFullName: `them/${name}` }),
      branch: "main",
      viaNonDefault: false,
      ahead,
      behind,
      status,
      branchesScanned: 1,
    },
    prs: [],
  };
}

const report: Report = {
  user: "me",
  generatedAt: "2026-08-30T00:00:00.000Z",
  totalForks: 69,
  scanned: 69,
  rows: [
    row("cloner", "diverged", 47, 26),
    row("talk-to-figma", "clean", 232, 0),
    row("yt-dlp", "bookmark", 0, 54),
  ],
};

describe("visibleRows", () => {
  test("hides bookmarks by default - they are the majority and pure noise", () => {
    expect(visibleRows(report.rows, false).map((r) => r.drift.fork.name)).toEqual([
      "cloner",
      "talk-to-figma",
    ]);
  });

  test("--all shows every fork", () => {
    expect(visibleRows(report.rows, true)).toHaveLength(3);
  });
});

describe("renderTable", () => {
  const out = renderTable(report, { color: false });

  test("shows the scan denominator so a filtered table is not mistaken for the whole account", () => {
    expect(out).toContain("69 forks scanned");
  });

  test("lists maintained forks and omits the bookmark", () => {
    expect(out).toContain("cloner");
    expect(out).toContain("talk-to-figma");
    expect(out).not.toContain("yt-dlp");
  });

  test("calls out diverged forks explicitly with the behind count", () => {
    expect(out).toContain("1 fork diverged");
    expect(out).toContain("is 26 behind them/cloner");
  });

  test("emits no ANSI codes when colour is off", () => {
    expect(out).not.toContain("\x1b[");
  });

  test("emits ANSI codes when colour is on", () => {
    expect(renderTable(report, { color: true })).toContain("\x1b[");
  });

  test("says so plainly when nothing has diverged", () => {
    const clean: Report = { ...report, rows: [row("a", "clean", 3, 0)] };
    expect(renderTable(clean, { color: false })).toContain("No diverged forks");
  });

  test("handles an account with no maintained forks at all", () => {
    const none: Report = { ...report, rows: [row("x", "bookmark", 0, 1)] };
    expect(renderTable(none, { color: false })).toContain("No maintained forks found");
  });

  test("surfaces the non-default-branch note", () => {
    const r = row("zerodelay", "clean", 7, 0);
    r.drift.viaNonDefault = true;
    r.drift.branch = "feat/latency-badge";
    r.drift.note = "work is on feat/latency-badge, not main";
    expect(renderTable({ ...report, rows: [r] }, { color: false })).toContain(
      "work is on feat/latency-badge",
    );
  });
});

describe("explained dead ends", () => {
  const withDeadEnds: Report = {
    ...report,
    rows: [
      row("cloner", "diverged", 47, 26),
      row("gone", "orphaned", 0, 0),
      row("rewritten", "unrelated", 0, 0),
      row("broken", "unknown", 0, 0),
      row("yt-dlp", "bookmark", 0, 54),
    ],
  };

  test("hides orphaned and unrelated - permanent facts, not drift", () => {
    const names = visibleRows(withDeadEnds.rows, false).map((r) => r.drift.fork.name);
    expect(names).toEqual(["cloner", "broken"]);
  });

  test("keeps 'unknown' visible - a failed run must not read as a clean one", () => {
    expect(renderTable(withDeadEnds, { color: false })).toContain("broken");
  });

  test("counts what it hid, so nothing vanishes without a trace", () => {
    const summary = hiddenSummary(withDeadEnds.rows);
    expect(summary).toContain("3 forks not shown");
    expect(summary).toContain("1 never patched");
    expect(summary).toContain("1 upstream deleted");
    expect(summary).toContain("1 unrelated history");
  });

  test("the hidden-count line reaches the rendered table", () => {
    expect(renderTable(withDeadEnds, { color: false })).toContain("not shown");
  });

  test("no hidden line when nothing is hidden", () => {
    expect(hiddenSummary([row("a", "clean", 1, 0)])).toBeNull();
  });
});

describe("renderJson", () => {
  test("is valid JSON and respects the same visibility filter", () => {
    const parsed = JSON.parse(renderJson(report, { all: false }));
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.totalForks).toBe(69);
  });
});

describe("summarisePrs", () => {
  test("renders an em dash when there are none", () => {
    expect(summarisePrs([])).toBe("—");
  });

  test("leads with open PRs, since those are the ones needing a nudge", () => {
    const pr = (number: number, state: "open" | "closed", merged: boolean) => ({
      number, state, merged, title: "t", url: "u", updatedAt: "2026-01-01",
    });
    const out = summarisePrs([pr(184, "open", false), pr(185, "closed", true), pr(9, "closed", false)]);
    expect(out).toBe("1 open (#184) · 1 merged · 1 closed");
  });
});
