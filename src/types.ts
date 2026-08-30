/** A fork of someone else's repository, with its upstream resolved. */
export interface ForkRef {
  fullName: string;
  owner: string;
  name: string;
  private: boolean;
  archived: boolean;
  defaultBranch: string;
  pushedAt: string;
  /** null when upstream was deleted or made private — the fork is orphaned. */
  parentFullName: string | null;
  parentDefaultBranch: string | null;
}

export type DriftStatus =
  /** Patched AND upstream moved. The only state that can turn into a merge conflict. */
  | "diverged"
  /** Patched, upstream static. Nothing to do. */
  | "clean"
  /** Never patched. A bookmark, not a fork you maintain. */
  | "bookmark"
  /** Upstream repo no longer exists. GitHub still reports it in `parent`. */
  | "orphaned"
  /** Upstream exists but shares no commit with the fork (history was rewritten). */
  | "unrelated"
  /** The comparison genuinely failed — a real error, not an explained state. */
  | "unknown";

export interface Drift {
  fork: ForkRef;
  /** The branch actually compared — not necessarily the default one. */
  branch: string;
  /** True when the winning branch was NOT the fork's default branch. */
  viaNonDefault: boolean;
  ahead: number;
  behind: number;
  status: DriftStatus;
  /** How many branches were examined to reach this verdict. */
  branchesScanned: number;
  note?: string;
}

export interface OutboundPr {
  number: number;
  title: string;
  state: "open" | "closed";
  merged: boolean;
  url: string;
  updatedAt: string;
}

export interface Report {
  user: string;
  generatedAt: string;
  totalForks: number;
  scanned: number;
  rows: ReportRow[];
}

export interface ReportRow {
  drift: Drift;
  prs: OutboundPr[];
}
