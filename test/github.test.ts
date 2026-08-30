import { describe, expect, test } from "bun:test";
import { GitHubClient, mapPool, parseNextLink } from "../src/github.ts";

describe("parseNextLink", () => {
  test("extracts rel=next and ignores the other rels", () => {
    const link =
      '<https://api.github.com/user/repos?page=2>; rel="next", <https://api.github.com/user/repos?page=5>; rel="last"';
    expect(parseNextLink(link)).toBe("https://api.github.com/user/repos?page=2");
  });

  test("returns null on the last page, where only prev/first are present", () => {
    const link = '<https://api.github.com/user/repos?page=1>; rel="prev"';
    expect(parseNextLink(link)).toBeNull();
  });

  test("returns null when the header is absent", () => {
    expect(parseNextLink(null)).toBeNull();
  });
});

describe("mapPool", () => {
  test("preserves input order even when tasks finish out of order", async () => {
    const out = await mapPool([30, 10, 20], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms / 10));
      return ms;
    });
    expect(out).toEqual([30, 10, 20]);
  });

  test("never exceeds the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    await mapPool(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
    });
    expect(peak).toBeLessThanOrEqual(4);
  });

  test("handles an empty input without hanging", async () => {
    expect(await mapPool([], 8, async () => 1)).toEqual([]);
  });
});

describe("GitHubClient.request", () => {
  test("maps 404 to null rather than throwing - a deleted upstream is data", async () => {
    const client = new GitHubClient({
      token: "t",
      fetchImpl: async () => new Response("nope", { status: 404 }),
    });
    expect(await client.request("/repos/x/y")).toBeNull();
  });

  test("retries a secondary rate limit and then succeeds", async () => {
    let calls = 0;
    const client = new GitHubClient({
      token: "t",
      sleepImpl: async () => {},
      fetchImpl: async () => {
        calls++;
        if (calls === 1) {
          return new Response("slow down", { status: 429, headers: { "retry-after": "1" } });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    });
    const res = await client.request<{ ok: boolean }>("/x");
    expect(res?.data.ok).toBe(true);
    expect(calls).toBe(2);
  });

  test("does NOT retry a 403 that still has budget - that is permissions, not throttling", async () => {
    let calls = 0;
    const client = new GitHubClient({
      token: "t",
      sleepImpl: async () => {},
      fetchImpl: async () => {
        calls++;
        return new Response("forbidden", {
          status: 403,
          headers: { "x-ratelimit-remaining": "4999" },
        });
      },
    });
    await expect(client.request("/x")).rejects.toThrow(/403/);
    expect(calls).toBe(1);
  });
});
