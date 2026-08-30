import type { GitHubClient } from "./github.ts";
import type { ForkRef, OutboundPr } from "./types.ts";

interface RawSearchItem {
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  updated_at: string;
  pull_request?: { merged_at: string | null };
}

interface RawSearch {
  items: RawSearchItem[];
}

/**
 * Pull requests this user has opened against the fork's upstream.
 *
 * Uses the search API rather than `/pulls?head=`, because the head filter needs
 * a branch name we do not know up front. Search has its own much tighter quota
 * (~30/min), so this is only ever called for maintained forks — a handful, not
 * the whole fork list.
 *
 * Failures here degrade to an empty list on purpose: PR status is a nice-to-have
 * column, and losing it must not take the drift table down with it.
 */
export async function fetchOutboundPrs(
  client: GitHubClient,
  fork: ForkRef,
  author: string,
): Promise<OutboundPr[]> {
  if (!fork.parentFullName) return [];

  const q = encodeURIComponent(`is:pr author:${author} repo:${fork.parentFullName}`);
  try {
    const res = await client.request<RawSearch>(`/search/issues?q=${q}&per_page=20`);
    return (res?.data.items ?? []).map(toPr);
  } catch {
    return [];
  }
}

export function toPr(item: RawSearchItem): OutboundPr {
  return {
    number: item.number,
    title: item.title,
    state: item.state,
    merged: Boolean(item.pull_request?.merged_at),
    url: item.html_url,
    updatedAt: item.updated_at,
  };
}

/** open → merged → closed-unmerged, since only the first needs chasing. */
export function summarisePrs(prs: OutboundPr[]): string {
  if (prs.length === 0) return "—";
  const open = prs.filter((p) => p.state === "open");
  const merged = prs.filter((p) => p.merged);
  const parts: string[] = [];
  if (open.length) parts.push(`${open.length} open (${open.map((p) => `#${p.number}`).join(", ")})`);
  if (merged.length) parts.push(`${merged.length} merged`);
  const rejected = prs.length - open.length - merged.length;
  if (rejected > 0) parts.push(`${rejected} closed`);
  return parts.join(" · ");
}
