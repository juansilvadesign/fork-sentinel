import { execFileSync } from "node:child_process";

export class AuthError extends Error {}

/**
 * Resolve a token without ever asking for one.
 *
 * Env first so CI can override, then the gh CLI's own keyring — which on a
 * developer machine is already authenticated, so the tool needs no setup step.
 */
export function resolveToken(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (fromEnv) return fromEnv.trim();

  try {
    const out = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const token = out.trim();
    if (token) return token;
  } catch {
    // fall through to the actionable error below
  }

  throw new AuthError(
    "No GitHub token found.\n" +
      "  Set GITHUB_TOKEN, or authenticate the gh CLI once:  gh auth login",
  );
}
