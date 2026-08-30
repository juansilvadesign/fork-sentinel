#!/usr/bin/env bun
import { AuthError, resolveToken } from "./auth.ts";
import { GitHubClient } from "./github.ts";
import { renderJson, renderTable } from "./render.ts";
import { run } from "./run.ts";

export interface Args {
  all: boolean;
  json: boolean;
  color: boolean;
  prs: boolean;
  scanBranches: boolean;
  exitCode: boolean;
  help: boolean;
  version: boolean;
  user?: string;
  limit?: number;
  concurrency: number;
}

const USAGE = `fork-sentinel - find the forks you actually maintain, and when upstream moved.

USAGE
  fork-sentinel [options]

OPTIONS
  --all              include bookmark forks (no commits of your own)
  --json             machine-readable output
  --user <login>     inspect another account's public forks
  --limit <n>        stop after n forks (useful while iterating)
  --concurrency <n>  parallel requests (default 8)
  --no-prs           skip the outbound pull-request lookup
  --no-branch-scan   compare default branches only (faster, under-reports)
  --no-color         disable ANSI colour
  --exit-code        exit 1 when any fork has diverged
  -h, --help         show this
  -v, --version      show version

AUTH
  Uses GITHUB_TOKEN / GH_TOKEN, else falls back to the gh CLI's own token.
`;

export function parseArgs(argv: readonly string[]): Args {
  const args: Args = {
    all: false,
    json: false,
    color: !process.env.NO_COLOR,
    prs: true,
    scanBranches: true,
    exitCode: false,
    help: false,
    version: false,
    concurrency: 8,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--all": args.all = true; break;
      case "--json": args.json = true; args.color = false; break;
      case "--no-prs": args.prs = false; break;
      case "--no-branch-scan": args.scanBranches = false; break;
      case "--no-color": args.color = false; break;
      case "--exit-code": args.exitCode = true; break;
      case "-h": case "--help": args.help = true; break;
      case "-v": case "--version": args.version = true; break;
      case "--user": args.user = argv[++i]; break;
      case "--limit": args.limit = Number(argv[++i]); break;
      case "--concurrency": args.concurrency = Number(argv[++i]); break;
      default:
        if (arg?.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (args.limit !== undefined && (!Number.isFinite(args.limit) || args.limit < 1)) {
    throw new Error("--limit expects a positive number");
  }
  if (!Number.isFinite(args.concurrency) || args.concurrency < 1) {
    throw new Error("--concurrency expects a positive number");
  }
  return args;
}

export async function main(argv: readonly string[]): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n\n${USAGE}`);
    return 2;
  }

  if (args.help) { process.stdout.write(USAGE); return 0; }
  if (args.version) { process.stdout.write("fork-sentinel 0.1.0\n"); return 0; }

  let token: string;
  try {
    token = resolveToken();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    return err instanceof AuthError ? 2 : 1;
  }

  const client = new GitHubClient({ token });
  const isTty = Boolean(process.stderr.isTTY);

  try {
    const report = await run(client, {
      user: args.user,
      concurrency: args.concurrency,
      limit: args.limit,
      prs: args.prs,
      scanBranches: args.scanBranches,
      onProgress: (done, total) => {
        if (isTty && !args.json) {
          process.stderr.write(`\r  scanning ${done}/${total} forks...`);
        }
      },
    });
    if (isTty && !args.json) process.stderr.write("\r\x1b[K");

    const opts = { color: args.color, all: args.all };
    process.stdout.write((args.json ? renderJson(report, opts) : renderTable(report, opts)) + "\n");

    const diverged = report.rows.some((r) => r.drift.status === "diverged");
    return args.exitCode && diverged ? 1 : 0;
  } catch (err) {
    process.stderr.write(`\nfork-sentinel failed: ${(err as Error).message}\n`);
    return 1;
  }
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
