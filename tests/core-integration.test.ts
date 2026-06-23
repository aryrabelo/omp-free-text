import { expect, test } from "bun:test";
import {
	legacyNotePathFor,
	notePathFor,
	parseTaskLine,
	renderWidgetLines,
	resolveLocation,
} from "@aryrabelo/free-text-core";

test("core resolves through the package surface", () => {
	const loc = resolveLocation({
		cwd: "/x/repo",
		repoToplevel: "/x/repo",
		branch: "main",
		sessionId: "s1",
	});
	expect(notePathFor(loc, "/home/u")).toBe(
		"/home/u/.free-text/repo/main/s1.md",
	);
	expect(legacyNotePathFor(loc, "/home/u")).toBe(
		"/home/u/.omp-free-text/repo/main/s1.md",
	);
	expect(parseTaskLine("- [ ] hi").state).toBe("pending");
	expect(renderWidgetLines("- [ ] hi").length).toBeGreaterThan(0);
});
