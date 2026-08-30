/**
 * Minimal GitHub REST client. No dependencies: bun/node 22 both ship fetch.
 *
 * Handles the three things that actually bite when you fan out ~150 requests:
 * primary rate limiting, GitHub's *secondary* rate limiter (which is a
 * different mechanism with a different response), and Link-header pagination.
 */

/**
 * Structural fetch signature. Deliberately not `typeof fetch`: Bun's global
 * carries extra properties (`preconnect`) that a test double has no business
 * implementing.
 */
export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface GitHubClientOptions {
  token: string;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  /** Injectable so tests never actually sleep. */
  sleepImpl?: (ms: number) => Promise<void>;
  maxRetries?: number;
  userAgent?: string;
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class GitHubClient {
  readonly #token: string;
  readonly #baseUrl: string;
  readonly #fetch: FetchLike;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #maxRetries: number;
  readonly #userAgent: string;

  /** Remaining primary-rate-limit budget, as of the last response seen. */
  remaining = Number.POSITIVE_INFINITY;
  requestCount = 0;

  constructor(opts: GitHubClientOptions) {
    this.#token = opts.token;
    this.#baseUrl = opts.baseUrl ?? "https://api.github.com";
    this.#fetch = opts.fetchImpl ?? fetch;
    this.#sleep = opts.sleepImpl ?? defaultSleep;
    this.#maxRetries = opts.maxRetries ?? 3;
    this.#userAgent = opts.userAgent ?? "fork-sentinel";
  }

  /**
   * One request. Returns null on 404 so callers can treat "gone" as data
   * rather than as an exception — an upstream repo being deleted is a normal
   * state for a fork, not an error.
   */
  async request<T>(path: string): Promise<{ data: T; headers: Headers } | null> {
    const res = await this.requestDetailed<T>(path);
    return res.ok ? { data: res.data, headers: res.headers } : null;
  }

  /**
   * Same request, but a 404 comes back with its body message intact.
   *
   * GitHub answers 404 for causes that mean opposite things — "upstream was
   * deleted" and "these histories share no commit" are both 404 on the compare
   * endpoint — so anything that needs to tell them apart has to read the body.
   */
  async requestDetailed<T>(
    path: string,
  ): Promise<
    { ok: true; data: T; headers: Headers } | { ok: false; status: number; message: string }
  > {
    const url = path.startsWith("http") ? path : `${this.#baseUrl}${path}`;

    for (let attempt = 0; attempt <= this.#maxRetries; attempt++) {
      this.requestCount++;
      const res = await this.#fetch(url, {
        headers: {
          Authorization: `Bearer ${this.#token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": this.#userAgent,
        },
      });

      const remainingHeader = res.headers.get("x-ratelimit-remaining");
      if (remainingHeader !== null) this.remaining = Number(remainingHeader);

      if (res.status === 404) {
        const body = await res.text().catch(() => "");
        let message = body;
        try {
          message = (JSON.parse(body) as { message?: string }).message ?? body;
        } catch {
          // a non-JSON 404 body is fine; keep the raw text
        }
        return { ok: false, status: 404, message };
      }

      if (res.ok) {
        return { ok: true, data: (await res.json()) as T, headers: res.headers };
      }

      // 403 and 429 both carry rate limiting, but only some 403s are rate
      // limits — a 403 with budget left is a permissions problem and retrying
      // it just burns the budget we do have.
      const isRateLimited =
        res.status === 429 ||
        (res.status === 403 && (this.remaining === 0 || res.headers.has("retry-after")));

      if (isRateLimited && attempt < this.#maxRetries) {
        await this.#sleep(this.#backoffMs(res, attempt));
        continue;
      }

      const body = await res.text().catch(() => "");
      throw new GitHubError(
        `GitHub ${res.status} on ${path}${body ? `: ${body.slice(0, 200)}` : ""}`,
        res.status,
        path,
      );
    }

    throw new GitHubError(`Exhausted retries on ${path}`, 429, path);
  }

  /** Honour Retry-After / x-ratelimit-reset when given; otherwise back off exponentially. */
  #backoffMs(res: Response, attempt: number): number {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 60_000);
    }
    const reset = res.headers.get("x-ratelimit-reset");
    if (reset) {
      const waitMs = Number(reset) * 1000 - Date.now();
      if (Number.isFinite(waitMs) && waitMs > 0) return Math.min(waitMs, 60_000);
    }
    return Math.min(1000 * 2 ** attempt, 30_000);
  }

  /** Follow Link rel="next" until exhausted. */
  async paginate<T>(path: string, cap = 10): Promise<T[]> {
    const out: T[] = [];
    let next: string | null = path;
    let pages = 0;

    while (next && pages < cap) {
      const res: { data: T[]; headers: Headers } | null = await this.request<T[]>(next);
      if (!res) break;
      out.push(...res.data);
      next = parseNextLink(res.headers.get("link"));
      pages++;
    }
    return out;
  }
}

/** Extract the rel="next" URL from a Link header. Returns null when absent. */
export function parseNextLink(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (match && match[2] === "next") return match[1] ?? null;
  }
  return null;
}

/** Bounded-concurrency map. Preserves input order in the output. */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index] as T, index);
    }
  });

  await Promise.all(workers);
  return results;
}
