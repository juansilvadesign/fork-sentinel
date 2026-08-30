import { describe, expect, test } from "bun:test";
import { parseArgs } from "../src/cli.ts";

describe("parseArgs", () => {
  test("defaults to the safe, useful configuration", () => {
    const a = parseArgs([]);
    expect(a.all).toBe(false);
    expect(a.prs).toBe(true);
    expect(a.scanBranches).toBe(true);
    expect(a.concurrency).toBe(8);
    expect(a.exitCode).toBe(false);
  });

  test("--json implies no colour, so piped output stays parseable", () => {
    expect(parseArgs(["--json"]).color).toBe(false);
  });

  test("reads valued flags", () => {
    const a = parseArgs(["--user", "octocat", "--limit", "5", "--concurrency", "2"]);
    expect(a.user).toBe("octocat");
    expect(a.limit).toBe(5);
    expect(a.concurrency).toBe(2);
  });

  test("negation flags turn features off", () => {
    const a = parseArgs(["--no-prs", "--no-branch-scan", "--no-color"]);
    expect(a.prs).toBe(false);
    expect(a.scanBranches).toBe(false);
    expect(a.color).toBe(false);
  });

  test("rejects an unknown option instead of silently ignoring it", () => {
    expect(() => parseArgs(["--wat"])).toThrow(/Unknown option/);
  });

  test("rejects a nonsense limit", () => {
    expect(() => parseArgs(["--limit", "0"])).toThrow(/positive number/);
    expect(() => parseArgs(["--limit", "abc"])).toThrow(/positive number/);
  });
});
