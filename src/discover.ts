import type { GitHubClient } from "./github.ts";
import { mapPool } from "./github.ts";
import type { ForkRef } from "./types.ts";

interface RawRepo {
  full_name: string;
  name: string;
  owner: { login: string };
  fork: boolean;
  private: boolean;
  archived: boolean;
  default_branch: string;
  pushed_at: string;
  parent?: { full_name: string; default_branch: string } | null;
}

/**
 * Every repo the user owns that GitHub marks as a fork.
 *
 * The list endpoints omit `parent`, so the upstream has to be resolved with a
 * second call per fork. That is the single biggest cost in a run, and there is
 * no bulk alternative on the REST API.
 */
export async function discoverForks(
  client: GitHubClient,
  opts: { user?: string; concurrency?: number; limit?: number } = {},
): Promise<{ forks: ForkRef[]; totalForks: number }> {
  const listPath = opts.user
    ? `/users/${opts.user}/repos?per_page=100&type=owner&sort=pushed`
    : `/user/repos?per_page=100&affiliation=owner&sort=pushed`;

  const repos = await client.paginate<RawRepo>(listPath);
  const forked = repos.filter((r) => r.fork);
  const totalForks = forked.length;
  const selected = opts.limit ? forked.slice(0, opts.limit) : forked;

  const detailed = await mapPool(selected, opts.concurrency ?? 8, async (repo) => {
    const res = await client.request<RawRepo>(`/repos/${repo.full_name}`);
    const parent = res?.data.parent ?? null;
    return {
      fullName: repo.full_name,
      owner: repo.owner.login,
      name: repo.name,
      private: repo.private,
      archived: repo.archived,
      defaultBranch: repo.default_branch,
      pushedAt: repo.pushed_at,
      parentFullName: parent?.full_name ?? null,
      parentDefaultBranch: parent?.default_branch ?? null,
    } satisfies ForkRef;
  });

  return { forks: detailed, totalForks };
}
