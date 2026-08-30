# fork-sentinel

Find the forks you actually maintain, and tell you when upstream moved underneath them.

A GitHub account collects forks. Most are bookmarks — you forked to read the code, or to
star it sideways, and never wrote a line. A few carry real patches. Only those can break,
and they break quietly: upstream lands 26 commits, and you find out during a merge.

`fork-sentinel` separates the two and reports only the ones that can hurt you.

```
fork-sentinel · juansilvadesign · 69 of 69 forks scanned

FORK                        UPSTREAM                               AHEAD  BEHIND  STATUS    OUTBOUND PRS
caveman                     JuliusBrussee/caveman                  3      309     DIVERGED  1 closed
Sink                        miantiao-me/Sink                       2      264     DIVERGED  —
ai-website-cloner-template  JCodesMore/ai-website-cloner-template  47     26      DIVERGED  —
ZeroDelay                   joaogfc/ZeroDelay                      6      13      DIVERGED  2 open (#47, #46) · 4 merged
    -> work is on feat/community-suite, not main
claude-switch               Abhishek21k/claude-switch              15     9       DIVERGED  4 merged
cursor-talk-to-figma-mcp    grab/cursor-talk-to-figma-mcp          232    0       clean     2 open (#186, #184) · 1 merged

9 forks diverged - upstream moved under patches you wrote:
  caveman is 309 behind JuliusBrussee/caveman
    git -C <path> fetch upstream && git -C <path> log --oneline main..upstream/main
  ...
52 forks not shown: 5 upstream deleted · 1 unrelated history · 46 never patched (--all to list)
```

## Install

Requires [Bun](https://bun.sh) 1.0+.

```sh
git clone https://github.com/<you>/fork-sentinel
cd fork-sentinel
bun install
bun run src/cli.ts
```

## Auth

No setup step. It reads `GITHUB_TOKEN` or `GH_TOKEN`, and otherwise falls back to the
[`gh` CLI](https://cli.github.com)'s own token — which on a developer machine is already
authenticated. A token needs only `public_repo`, or `repo` to include private forks.

## Usage

```sh
fork-sentinel                    # maintained forks, riskiest first
fork-sentinel --all              # include bookmarks and dead upstreams
fork-sentinel --json             # machine-readable
fork-sentinel --user octocat     # someone else's public forks
fork-sentinel --exit-code        # exit 1 if anything diverged (for CI)
fork-sentinel --no-branch-scan   # faster, at the cost of under-reporting
```

## What the statuses mean

| Status | Meaning | Shown by default |
|---|---|---|
| `DIVERGED` | You patched it **and** upstream moved. The only state that can become a merge conflict. | yes |
| `clean` | You patched it, upstream hasn't moved. Nothing to do. | yes |
| `unknown` | The comparison genuinely failed. A tool fault, not a verdict. | yes |
| `bookmark` | No commits of your own. Not a fork you maintain. | `--all` |
| `orphaned` | Upstream no longer exists. | `--all` |
| `unrelated` | Upstream rewrote history; no shared commit. Never comparable. | `--all` |

Rows are sorted riskiest-first: diverged (by how far behind), then clean, then the rest.

## Three things that are less obvious than they look

**1. `ahead > 0` is the load-bearing filter.** On a real account the fork list is mostly
bookmarks — 46 of 69 in the run above. Without this filter the report is unreadable, and a
watcher nobody reads is worse than none.

**2. Comparing default branch to default branch under-reports badly.** A fork whose `main`
tracks upstream while the work sits on feature branches reports `0 ahead` — so the
`ahead > 0` filter then drops it entirely, and the repo you are *most* active in is the one
that vanishes. This is not an edge case: it is the normal shape for anyone who forks in
order to open pull requests. Every maintained fork on `--user sindresorhus` has its work on
a non-default branch. So when the default branch carries nothing, `fork-sentinel` scans the
other branches and keeps the one furthest ahead, reporting which branch it used. Pay for it
only when needed — a fork already ahead on its default branch never triggers the scan.

**3. `parent !== null` is not proof the upstream exists.** GitHub keeps reporting a
`parent` long after that repository is deleted, and the compare endpoint then answers a bare
`404` — the same status it returns when two histories share no commit, which means something
completely different. `fork-sentinel` reads the 404 body to separate them, and spends one
extra request confirming a deleted upstream rather than filing both under a vague error.

## Cost

One run over 69 forks: ~15 seconds, roughly 200 requests against a 5,000/hour limit.
Outbound-PR lookups use the search API (a much tighter ~30/min quota), so they run only for
maintained forks — a handful, never the whole list. `--no-prs` skips them.

## Development

```sh
bun test          # 46 tests, no network
bunx tsc --noEmit # typecheck
```

Tests are entirely offline: the GitHub client takes an injectable `fetch`, and every
scenario — pagination, secondary rate limits, the non-default-branch fallback, deleted
upstreams — runs against a recorded fake.

## Not in this version

Detecting when an upstream commit touches a file **your fork patched** — the warning that
tells you a conflict is coming before you merge. That needs the patched-file set per fork and
is the planned next step.

## Licence

MIT
