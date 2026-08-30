import type { GitHubClient } from "./github.ts";
import type { Drift, DriftStatus, ForkRef } from "./types.ts";

interface RawCompare {
  ahead_by: number;
  behind_by: number;
}

interface RawBranch {
  name: string;
}

/**
 * Turn raw ahead/behind counts into the state we actually act on.
 *
 * `ahead === 0` is the load-bearing distinction: a fork with no commits of your
 * own is a bookmark. Reporting those is what makes a fork watcher unreadable —
 * they are the overwhelming majority of any real account's fork list.
 */
export function classify(ahead: number, behind: number): DriftStatus {
  if (ahead > 0 && behind > 0) return "diverged";
  if (ahead > 0) return "clean";
  return "bookmark";
}

/** Riskiest first: diverged (by how far behind), then clean, then bookmarks. */
export function compareRisk(a: Drift, b: Drift): number {
  const rank: Record<DriftStatus, number> = {
    diverged: 0,
    clean: 1,
    unknown: 2,
    orphaned: 3,
    unrelated: 4,
    bookmark: 5,
  };
  const byStatus = rank[a.status] - rank[b.status];
  if (byStatus !== 0) return byStatus;
  if (b.behind !== a.behind) return b.behind - a.behind;
  return b.ahead - a.ahead;
}

/**
 * Pick the branch that best represents "what this fork carries".
 *
 * Comparing default-to-default alone is wrong for a real account: a fork whose
 * `main` tracks upstream while the work sits on feature branches reports 0
 * ahead, and then an `ahead > 0` filter drops it entirely. So when the default
 * branch is not ahead, fall back to scanning the other branches and keep the
 * one furthest ahead.
 */
export async function measureDrift(
  client: GitHubClient,
  fork: ForkRef,
  opts: { scanBranches?: boolean; maxBranches?: number } = {},
): Promise<Drift> {
  const base = {
    fork,
    branch: fork.defaultBranch,
    viaNonDefault: false,
    ahead: 0,
    behind: 0,
    branchesScanned: 0,
  };

  if (!fork.parentFullName || !fork.parentDefaultBranch) {
    return { ...base, status: "orphaned", note: "upstream deleted or private" };
  }

  const head = await compareBranch(client, fork, fork.defaultBranch);

  if (head.kind !== "ok") {
    return { ...base, branchesScanned: 1, ...(await explainFailure(client, fork, head)) };
  }

  let best: Drift = {
    ...base,
    ahead: head.ahead,
    behind: head.behind,
    branchesScanned: 1,
    status: classify(head.ahead, head.behind),
  };

  // Only worth paying for when the default branch carries nothing of ours.
  if (best.ahead > 0 || opts.scanBranches === false) return best;

  const branchRes = await client.request<RawBranch[]>(
    `/repos/${fork.fullName}/branches?per_page=100`,
  );
  const others = (branchRes?.data ?? [])
    .map((b) => b.name)
    .filter((name) => name !== fork.defaultBranch)
    .slice(0, opts.maxBranches ?? 20);

  for (const name of others) {
    const cmp = await compareBranch(client, fork, name);
    best.branchesScanned++;
    if (cmp.kind !== "ok") continue;
    if (cmp.ahead > best.ahead) {
      best = {
        ...best,
        branch: name,
        viaNonDefault: true,
        ahead: cmp.ahead,
        behind: cmp.behind,
        status: classify(cmp.ahead, cmp.behind),
      };
    }
  }

  if (best.viaNonDefault) {
    best.note = `work is on ${best.branch}, not ${fork.defaultBranch}`;
  }
  return best;
}

export type CompareOutcome =
  | { kind: "ok"; ahead: number; behind: number }
  /** Upstream rewrote history; the two repos share no commit. Never comparable. */
  | { kind: "unrelated" }
  /** 404 for some other reason - most often a deleted upstream. */
  | { kind: "missing" }
  | { kind: "error" };

async function compareBranch(
  client: GitHubClient,
  fork: ForkRef,
  branch: string,
): Promise<CompareOutcome> {
  // Branch names legitimately contain "/" and GitHub expects it unencoded here.
  const basehead = `${fork.parentDefaultBranch}...${fork.owner}:${branch}`;
  try {
    const res = await client.requestDetailed<RawCompare>(
      `/repos/${fork.parentFullName}/compare/${basehead}`,
    );
    if (res.ok) return { kind: "ok", ahead: res.data.ahead_by, behind: res.data.behind_by };
    return /no common ancestor/i.test(res.message) ? { kind: "unrelated" } : { kind: "missing" };
  } catch {
    return { kind: "error" };
  }
}

/**
 * Say which thing went wrong, rather than filing every failure under "unknown".
 *
 * A bare 404 from compare is ambiguous, so when the message does not already
 * explain it we spend one extra request asking whether upstream still exists.
 * GitHub keeps reporting a `parent` long after that repo is deleted, so this is
 * the only way to tell a dead upstream from a real fault.
 */
async function explainFailure(
  client: GitHubClient,
  fork: ForkRef,
  outcome: CompareOutcome,
): Promise<Pick<Drift, "status" | "note">> {
  if (outcome.kind === "unrelated") {
    return { status: "unrelated", note: `no common history with ${fork.parentFullName}` };
  }
  if (outcome.kind === "missing") {
    const parent = await client.request(`/repos/${fork.parentFullName}`);
    if (parent === null) {
      return { status: "orphaned", note: `upstream ${fork.parentFullName} no longer exists` };
    }
  }
  return { status: "unknown", note: "comparison failed" };
}
