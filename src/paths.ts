/**
 * Pure path derivation for free-text session notes.
 *
 * No filesystem, no git, no TUI — all inputs are passed in so this module is
 * fully unit-testable. The owning extension (`main.ts`) fetches the raw git /
 * session values and feeds them here.
 *
 * Target layout: `~/.omp-free-text/{repo}/{branch}/{session-id}.md`
 */
import { homedir } from "node:os";
import { basename, join } from "node:path";

/** Top-level directory under the user's home where all notes live. */
export const ROOT_DIR_NAME = ".omp-free-text";

/**
 * Make an arbitrary string safe to use as a single filesystem path segment.
 *
 * Collapses path separators and non-word characters to dashes and strips
 * leading/trailing dots and dashes (prevents hidden files and `..` traversal).
 * Returns `fallback` when nothing usable remains.
 */
export function sanitizeSegment(input: string, fallback: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[/\\]+/g, "-")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return slug.length > 0 ? slug : fallback;
}

/** Raw, possibly-missing inputs gathered at runtime. */
export interface RawLocation {
  /** Working directory of the session (`ctx.cwd`). Always present. */
  cwd: string;
  /** `git rev-parse --show-toplevel` output, or null/undefined outside a repo. */
  repoToplevel?: string | null;
  /** `git rev-parse --abbrev-ref HEAD` output, or null/undefined outside a repo. */
  branch?: string | null;
  /** OMP session id (`ctx.sessionManager.getSessionId()`). Always present. */
  sessionId: string;
}

/** Sanitized, always-populated path segments. */
export interface ResolvedLocation {
  repo: string;
  branch: string;
  sessionId: string;
}

/**
 * Resolve raw runtime values into safe path segments, applying fallbacks:
 * - repo: basename of the git toplevel, else basename of `cwd`.
 * - branch: the git branch, `detached` for a detached HEAD, else `no-branch`.
 * - sessionId: the OMP session id.
 */
export function resolveLocation(raw: RawLocation): ResolvedLocation {
  const top = raw.repoToplevel?.trim();
  const repoBase = top && top.length > 0 ? basename(top) : basename(raw.cwd);
  const repo = sanitizeSegment(repoBase, "no-repo");

  const rawBranch = raw.branch?.trim();
  let branchName: string;
  if (!rawBranch || rawBranch.length === 0) branchName = "no-branch";
  else if (rawBranch === "HEAD") branchName = "detached";
  else branchName = rawBranch;
  const branch = sanitizeSegment(branchName, "no-branch");

  const sessionId = sanitizeSegment(raw.sessionId, "no-session");
  return { repo, branch, sessionId };
}

/** Absolute path to the markdown note file for a resolved location. */
export function notePathFor(loc: ResolvedLocation, home: string = homedir()): string {
  return join(home, ROOT_DIR_NAME, loc.repo, loc.branch, `${loc.sessionId}.md`);
}
