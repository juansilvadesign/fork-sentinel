import { GitHubClient } from "../src/github.ts";
import type { FetchLike } from "../src/github.ts";
import type { ForkRef } from "../src/types.ts";

export interface Route {
  body: unknown;
  status?: number;
  headers?: Record<string, string>;
}

/** Records every path requested, so tests can assert on call *shape*, not just results. */
export class FakeApi {
  readonly calls: string[] = [];
  constructor(private routes: Record<string, Route>) {}

  fetch: FetchLike = async (input) => {
    const url = String(input);
    const path = url.replace("https://api.github.com", "");
    this.calls.push(path);

    const route = this.routes[path];
    if (!route) {
      return new Response("not found", { status: 404 });
    }
    return new Response(JSON.stringify(route.body), {
      status: route.status ?? 200,
      headers: { "content-type": "application/json", ...(route.headers ?? {}) },
    });
  };

  client(): GitHubClient {
    return new GitHubClient({
      token: "t",
      fetchImpl: this.fetch,
      sleepImpl: async () => {},
    });
  }
}

export function fork(overrides: Partial<ForkRef> = {}): ForkRef {
  return {
    fullName: "me/proj",
    owner: "me",
    name: "proj",
    private: false,
    archived: false,
    defaultBranch: "main",
    pushedAt: "2026-08-01T00:00:00Z",
    parentFullName: "them/proj",
    parentDefaultBranch: "main",
    ...overrides,
  };
}
