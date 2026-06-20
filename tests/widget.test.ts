import { describe, expect, test } from "bun:test";
import {
	EMPTY_HINT,
	PLAIN_STYLE,
	renderWidgetLines,
	SHORTCUT_HINT,
	type WidgetStyle,
} from "../src/widget";

describe("renderWidgetLines", () => {
	test("shows the empty hint then the shortcut when the note is empty", () => {
		expect(renderWidgetLines("")).toEqual([EMPTY_HINT, SHORTCUT_HINT]);
		expect(renderWidgetLines("   \n  ")).toEqual([EMPTY_HINT, SHORTCUT_HINT]);
	});

	test("shows the note body first, then the shortcut", () => {
		expect(renderWidgetLines("one\ntwo")).toEqual([
			"one",
			"two",
			SHORTCUT_HINT,
		]);
	});

	test("keeps only the trailing lines and never exceeds 10 lines", () => {
		const content = Array.from({ length: 30 }, (_, i) => `line${i + 1}`).join(
			"\n",
		);
		const lines = renderWidgetLines(content);
		expect(lines.length).toBe(10);
		expect(lines[0]).toBe("line22");
		expect(lines.at(-1)).toBe(SHORTCUT_HINT);
		expect(lines.at(-2)).toBe("line30");
	});

	test("respects a custom shortcut and a smaller maxLines", () => {
		const lines = renderWidgetLines("a\nb\nc\nd", {
			shortcut: "S",
			maxLines: 3,
		});
		expect(lines).toEqual(["c", "d", "S"]);
	});

	test("clamps maxLines above 10 back down to 10", () => {
		const content = Array.from({ length: 30 }, (_, i) => `l${i}`).join("\n");
		expect(renderWidgetLines(content, { maxLines: 50 }).length).toBe(10);
	});

	test("applies the title block, indent, tree hook, and per-line styling when a style is given", () => {
		const style: WidgetStyle = {
			title: "T",
			hook: "└",
			indent: ">>",
			hint: (t: string): string => `H<${t}>`,
			body: (t: string): string => `B<${t}>`,
			shortcut: (t: string): string => `S<${t}>`,
			taskPending: (t: string): string => t,
			taskInflight: (t: string): string => t,
			taskDone: (t: string): string => t,
			strike: (t: string): string => t,
			continuation: (t: string): string => t,
		};
		expect(renderWidgetLines("", { style })).toEqual([
			"",
			"T",
			`>>H<${EMPTY_HINT}>`,
			`>>S<${SHORTCUT_HINT}>`,
		]);
		expect(renderWidgetLines("one\ntwo", { style })).toEqual([
			"",
			"T",
			"B<>>└ one>",
			"B<>>  two>",
			`>>S<${SHORTCUT_HINT}>`,
		]);
	});

	test("reserves room for the title block within maxLines", () => {
		const style: WidgetStyle = { ...PLAIN_STYLE, title: "T" };
		const content = Array.from({ length: 30 }, (_, i) => `line${i + 1}`).join(
			"\n",
		);
		const lines = renderWidgetLines(content, { style });
		expect(lines.length).toBe(10);
		expect(lines[0]).toBe("");
		expect(lines[1]).toBe("T");
		expect(lines.at(-1)).toBe(SHORTCUT_HINT);
		expect(lines.at(-2)).toBe("line30");
	});

	test("PLAIN_STYLE leaves output unprefixed and unstyled", () => {
		expect(renderWidgetLines("one", { style: PLAIN_STYLE })).toEqual([
			"one",
			SHORTCUT_HINT,
		]);
	});

	// ── task-state glyph rendering ───────────────────────────────────────────

	test("pending checkbox renders as ☐ glyph (PLAIN_STYLE)", () => {
		expect(renderWidgetLines("- [ ] buy milk")).toEqual([
			"☐ buy milk",
			SHORTCUT_HINT,
		]);
	});

	test("in-flight checkbox renders as ▸ glyph (PLAIN_STYLE)", () => {
		expect(renderWidgetLines("- [>] buy milk")).toEqual([
			"▸ buy milk",
			SHORTCUT_HINT,
		]);
	});

	test("done checkbox renders as ✓ glyph (PLAIN_STYLE)", () => {
		expect(renderWidgetLines("- [x] buy milk")).toEqual([
			"✓ buy milk",
			SHORTCUT_HINT,
		]);
		expect(renderWidgetLines("- [X] buy milk")).toEqual([
			"✓ buy milk",
			SHORTCUT_HINT,
		]);
	});

	test("prose line passes through body styler without a glyph (gutter empty in PLAIN_STYLE)", () => {
		expect(renderWidgetLines("hello")).toEqual(["hello", SHORTCUT_HINT]);
	});

	test("routes each task state to the correct per-state styler", () => {
		const style: WidgetStyle = {
			...PLAIN_STYLE,
			taskPending: (t: string): string => `[pending:${t}]`,
			taskInflight: (t: string): string => `[inflight:${t}]`,
			taskDone: (t: string): string => `[done:${t}]`,
		};
		const content = "- [ ] todo\n- [>] wip\n- [x] finished";
		expect(renderWidgetLines(content, { style })).toEqual([
			"[pending:☐ todo]",
			"[inflight:▸ wip]",
			"[done:✓ finished]",
			SHORTCUT_HINT,
		]);
	});
});

describe("renderWidgetLines — done-block cap (maxDone)", () => {
	test("shows at most 2 done blocks by default, dropping older ones", () => {
		const note = "- [x] a\n- [x] b\n- [x] c\n- [ ] d";
		expect(renderWidgetLines(note, { maxLines: 10 })).toEqual([
			"✓ b",
			"✓ c",
			"☐ d",
			SHORTCUT_HINT,
		]);
	});

	test("drops a done block together with its continuation lines", () => {
		const note = "- [x] a\n  detail a\n- [x] b\n- [x] c";
		expect(renderWidgetLines(note, { maxLines: 10, maxDone: 2 })).toEqual([
			"✓ b",
			"✓ c",
			SHORTCUT_HINT,
		]);
	});

	test("keeps all done blocks when under the cap", () => {
		const note = "- [x] a\n- [x] b";
		expect(renderWidgetLines(note, { maxLines: 10 })).toEqual([
			"✓ a",
			"✓ b",
			SHORTCUT_HINT,
		]);
	});
});

describe("renderWidgetLines — multi-line continuation", () => {
	test("indented continuation lines render with the ┆ connector, not the gutter", () => {
		expect(renderWidgetLines("- [ ] head\n  detail one\n  detail two")).toEqual(
			["☐ head", "┆ detail one", "┆ detail two", SHORTCUT_HINT],
		);
	});

	test("continuation inherits the parent task's state styler (whole block one color)", () => {
		const style: WidgetStyle = {
			...PLAIN_STYLE,
			taskPending: (t: string): string => `[P:${t}]`,
			taskInflight: (t: string): string => `[I:${t}]`,
			taskDone: (t: string): string => `[D:${t}]`,
			continuation: (t: string): string => `[orphan:${t}]`,
		};
		expect(renderWidgetLines("- [ ] head\n  more", { style })).toEqual([
			"[P:☐ head]",
			"[P:┆ more]",
			SHORTCUT_HINT,
		]);
		expect(renderWidgetLines("- [>] head\n  more", { style })).toEqual([
			"[I:▸ head]",
			"[I:┆ more]",
			SHORTCUT_HINT,
		]);
		expect(renderWidgetLines("- [x] head\n  more", { style })).toEqual([
			"[D:✓ head]",
			"[D:┆ more]",
			SHORTCUT_HINT,
		]);
	});

	test("orphan continuation (no head in view) falls back to the continuation styler", () => {
		const style: WidgetStyle = {
			...PLAIN_STYLE,
			continuation: (t: string): string => `[orphan:${t}]`,
		};
		expect(renderWidgetLines("  stray", { style })).toEqual([
			"[orphan:┆ stray]",
			SHORTCUT_HINT,
		]);
	});

	test("a blank line ends the continuation group (next continuation is orphan)", () => {
		const style: WidgetStyle = {
			...PLAIN_STYLE,
			taskPending: (t: string): string => `[P:${t}]`,
			continuation: (t: string): string => `[orphan:${t}]`,
		};
		expect(renderWidgetLines("- [ ] head\n\n  stray", { style })).toEqual([
			"[P:☐ head]",
			"",
			"[orphan:┆ stray]",
			SHORTCUT_HINT,
		]);
	});
});
