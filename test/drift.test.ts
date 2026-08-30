import { describe, expect, test } from "bun:test";
import { classify, compareRisk, measureDrift } from "../src/drift.ts";
import type { Drift } from "../src/types.ts";
import { FakeApi, fork } from "./helpers.ts";

describe("classify", () => {
  test("patched and behind is diverged - the only conflict-capable state", () => {
    expect(classify(47, 26)).toBe("diverged");
  });
  test("patched and current is clean", () => {
    expect(classify(232, 0)).toBe("clean");
  });
  test("never patched is a bookmark, however far behind", () => {
    expect(classify(0, 54)).toBe("bookmark");
    expect(classify(0, 0)).toBe("bookmark");
  });
});

describe("compareRisk", () => {
  const d = (status: Drift["status"], ahead: number, behind: number) =>
    ({ status, ahead, behind }) as Drift;

  test("diverged sorts above clean, clean above bookmark", () => {
    const sorted = [d("bookmark", 0, 99), d("clean", 5, 0), d("diverged", 1, 1)].sort(compareRisk);
    expect(sorted.map((x) => x.status)).toEqual(["diverged", "clean", "bookmark"]);
  });

  test("within diverged, furthest behind comes first", () => {
    const sorted = [d("diverged", 1, 9), d("diverged", 1, 26)].sort(compareRisk);
    expect(sorted.map((x) => x.behind)).toEqual([26, 9]);
  });
});

describe("measureDrift", () => {
  test("reads ahead/behind from the default branch when the work lives there", async () => {
    const api = new FakeApi({
      "/repos/them/proj/compare/main...me:main": { body: { ahead_by: 15, behind_by: 9 } },
    });
    const drift = await measureDrift(api.client(), fork());
    expect(drift.ahead).toBe(15);
    expect(drift.behind).toBe(9);
    expect(drift.status).toBe("diverged");
    expect(drift.viaNonDefault).toBe(false);
    expect(drift.branchesScanned).toBe(1);
  });

  test("REGRESSION: finds work on a non-default branch when main tracks upstream", async () => {
    // The ZeroDelay shape: main is even with upstream, but feature branches
    // carry the actual work. Comparing default-to-default alone reports 0 ahead,
    // and the ahead>0 filter would then drop the repo from the report entirely.
    const api = new FakeApi({
      "/repos/them/proj/compare/main...me:main": { body: { ahead_by: 0, behind_by: 0 } },
      "/repos/me/proj/branches?per_page=100": {
        body: [{ name: "main" }, { name: "feat/latency-badge" }, { name: "ci/nightly-canary" }],
      },
      "/repos/them/proj/compare/main...me:feat/latency-badge": {
        body: { ahead_by: 7, behind_by: 0 },
      },
      "/repos/them/proj/compare/main...me:ci/nightly-canary": {
        body: { ahead_by: 2, behind_by: 0 },
      },
    });

    const drift = await measureDrift(api.client(), fork());
    expect(drift.ahead).toBe(7);
    expect(drift.branch).toBe("feat/latency-badge");
    expect(drift.viaNonDefault).toBe(true);
    expect(drift.status).toBe("clean");
    expect(drift.note).toContain("feat/latency-badge");
  });

  test("skips the branch scan entirely when the default branch is already ahead", async () => {
    const api = new FakeApi({
      "/repos/them/proj/compare/main...me:main": { body: { ahead_by: 3, behind_by: 0 } },
    });
    await measureDrift(api.client(), fork());
    expect(api.calls.some((c) => c.includes("/branches"))).toBe(false);
  });

  test("honours --no-branch-scan by not listing branches", async () => {
    const api = new FakeApi({
      "/repos/them/proj/compare/main...me:main": { body: { ahead_by: 0, behind_by: 4 } },
    });
    const drift = await measureDrift(api.client(), fork(), { scanBranches: false });
    expect(drift.status).toBe("bookmark");
    expect(api.calls.some((c) => c.includes("/branches"))).toBe(false);
  });

  test("a fork whose upstream was deleted is orphaned, not crashed on", async () => {
    const api = new FakeApi({});
    const drift = await measureDrift(
      api.client(),
      fork({ parentFullName: null, parentDefaultBranch: null }),
    );
    expect(drift.status).toBe("orphaned");
    expect(api.calls).toHaveLength(0);
  });

  test("a 404 compare plus a 404 upstream means the upstream was DELETED", async () => {
    // GitHub keeps reporting `parent` long after that repo is gone, so a
    // non-null parent is not evidence the upstream exists.
    const api = new FakeApi({}); // compare 404s, and so does /repos/them/proj
    const drift = await measureDrift(api.client(), fork());
    expect(drift.status).toBe("orphaned");
    expect(drift.note).toContain("no longer exists");
    expect(drift.ahead).toBe(0);
  });

  test("'no common ancestor' is reported as unrelated, not as a deleted upstream", async () => {
    const api = new FakeApi({
      "/repos/them/proj/compare/main...me:main": {
        status: 404,
        body: { message: "No common ancestor between main and me:main." },
      },
    });
    const drift = await measureDrift(api.client(), fork());
    expect(drift.status).toBe("unrelated");
    expect(drift.note).toContain("no common history");
    // It must NOT waste a request probing an upstream that plainly exists.
    expect(api.calls.some((c) => c === "/repos/them/proj")).toBe(false);
  });

  test("a 404 compare against a LIVE upstream is a real fault, reported as unknown", async () => {
    const api = new FakeApi({
      "/repos/them/proj": { body: { full_name: "them/proj" } },
      // compare route absent -> 404 with no explanatory message
    });
    const drift = await measureDrift(api.client(), fork());
    expect(drift.status).toBe("unknown");
    expect(drift.note).toContain("comparison failed");
  });
});
