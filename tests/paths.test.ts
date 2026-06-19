import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
	configPathFor,
	historyPathFor,
	notePathFor,
	ROOT_DIR_NAME,
	resolveLocation,
	sanitizeSegment,
	sessionsDirFor,
} from "../src/paths";

describe("sanitizeSegment", () => {
	test("returns fallback for empty or unusable input", () => {
		expect(sanitizeSegment("", "fb")).toBe("fb");
		expect(sanitizeSegment("   ", "fb")).toBe("fb");
		expect(sanitizeSegment("...", "fb")).toBe("fb");
		expect(sanitizeSegment("///", "fb")).toBe("fb");
	});

	test("collapses path separators and unsafe chars to dashes", () => {
		expect(sanitizeSegment("feat/foo bar", "fb")).toBe("feat-foo-bar");
		expect(sanitizeSegment("a\\b:c*d", "fb")).toBe("a-b-c-d");
	});

	test("strips leading/trailing dots and dashes (no hidden files or traversal)", () => {
		expect(sanitizeSegment("..evil", "fb")).toBe("evil");
		expect(sanitizeSegment("-x-", "fb")).toBe("x");
		expect(sanitizeSegment("..", "fb")).toBe("fb");
	});

	test("keeps word chars, dots and dashes inside the segment", () => {
		expect(sanitizeSegment("172940-abc.def", "fb")).toBe("172940-abc.def");
	});
});

describe("resolveLocation", () => {
	test("uses git toplevel basename and branch when present", () => {
		expect(
			resolveLocation({
				cwd: "/home/u/proj/sub",
				repoToplevel: "/home/u/proj",
				branch: "main",
				sessionId: "sess1",
			}),
		).toEqual({ repo: "proj", branch: "main", sessionId: "sess1" });
	});

	test("flattens a slashed branch into one segment", () => {
		expect(
			resolveLocation({
				cwd: "/x",
				repoToplevel: "/x",
				branch: "feat/cool-thing",
				sessionId: "s",
			}).branch,
		).toBe("feat-cool-thing");
	});

	test("falls back to cwd basename and no-branch outside a repo", () => {
		expect(
			resolveLocation({
				cwd: "/home/u/scratch",
				repoToplevel: null,
				branch: null,
				sessionId: "s",
			}),
		).toEqual({ repo: "scratch", branch: "no-branch", sessionId: "s" });
	});

	test("treats detached HEAD as 'detached'", () => {
		expect(
			resolveLocation({
				cwd: "/x",
				repoToplevel: "/x",
				branch: "HEAD",
				sessionId: "s",
			}).branch,
		).toBe("detached");
	});

	test("empty/whitespace git output falls back like no repo", () => {
		expect(
			resolveLocation({
				cwd: "/home/u/p",
				repoToplevel: "  ",
				branch: "  ",
				sessionId: "s",
			}),
		).toEqual({ repo: "p", branch: "no-branch", sessionId: "s" });
	});
});

describe("notePathFor", () => {
	test("builds ~/.omp-free-text/{repo}/{branch}/{session}.md under the given home", () => {
		const path = notePathFor({ repo: "proj", branch: "main", sessionId: "abc" }, "/home/u");
		expect(path).toBe(join("/home/u", ROOT_DIR_NAME, "proj", "main", "abc.md"));
	});
});

describe("historyPathFor", () => {
	test("builds ~/.omp-free-text/{repo}/{branch}/{session}.history.md under the given home", () => {
		const path = historyPathFor({ repo: "proj", branch: "main", sessionId: "abc" }, "/home/u");
		expect(path).toBe(join("/home/u", ROOT_DIR_NAME, "proj", "main", "abc.history.md"));
	});
});

describe("sessionsDirFor", () => {
	test("is the {repo}/{branch} directory under the root", () => {
		expect(sessionsDirFor({ repo: "proj", branch: "main", sessionId: "x" }, "/home/u")).toBe(
			join("/home/u", ROOT_DIR_NAME, "proj", "main"),
		);
	});
});

describe("configPathFor", () => {
	test("returns ~/.omp-free-text/config.json under the given home", () => {
		expect(configPathFor("/home/u")).toBe(join("/home/u", ROOT_DIR_NAME, "config.json"));
	});
});
