import { discoverForks } from "./discover.ts";
import { compareRisk, measureDrift } from "./drift.ts";
import { GitHubClient, mapPool } from "./github.ts";
import { fetchOutboundPrs } from "./prs.ts";
import type { Report, ReportRow } from "./types.ts";

export interface RunOptions {
  user?: string;
  concurrency?: number;
  limit?: number;
  prs?: boolean;
  scanBranches?: boolean;
  now?: () => Date;
  onProgress?: (done: number, total: number) => void;
}

/** The whole pipeline, as a pure-ish function so the CLI stays a thin shell. */
export async function run(client: GitHubClient, opts: RunOptions = {}): Promise<Report> {
  const concurrency = opts.concurrency ?? 8;
  const { forks, totalForks } = await discoverForks(client, {
    user: opts.user,
    concurrency,
    limit: opts.limit,
  });

  let done = 0;
  const drifts = await mapPool(forks, concurrency, async (fork) => {
    const drift = await measureDrift(client, fork, { scanBranches: opts.scanBranches });
    opts.onProgress?.(++done, forks.length);
    return drift;
  });

  const maintained = drifts.filter((d) => d.status === "diverged" || d.status === "clean");
  const prsByFork = new Map<string, Awaited<ReturnType<typeof fetchOutboundPrs>>>();

  if (opts.prs !== false && maintained.length > 0) {
    const author = opts.user ?? forks[0]?.owner ?? "";
    // Search has a ~30/min quota of its own, so keep this narrow and serial-ish.
    const results = await mapPool(maintained, 3, (d) => fetchOutboundPrs(client, d.fork, author));
    for (const [i, prs] of results.entries()) {
      prsByFork.set(maintained[i]!.fork.fullName, prs);
    }
  }

  const rows: ReportRow[] = drifts
    .map((drift) => ({ drift, prs: prsByFork.get(drift.fork.fullName) ?? [] }))
    .sort((a, b) => compareRisk(a.drift, b.drift));

  return {
    user: opts.user ?? forks[0]?.owner ?? "(authenticated user)",
    generatedAt: (opts.now?.() ?? new Date()).toISOString(),
    totalForks,
    scanned: forks.length,
    rows,
  };
}
