import { describe, expect, test } from "bun:test";
import {
	DEFAULT_SHORTCUTS,
	humanizeKey,
	parseShortcutConfig,
	queueHint,
} from "../src/config";

describe("parseShortcutConfig", () => {
	test("empty string returns DEFAULT_SHORTCUTS with no warnings", () => {
		const result = parseShortcutConfig("");
		expect(result.shortcuts).toEqual(DEFAULT_SHORTCUTS);
		expect(result.warnings).toHaveLength(0);
	});

	test("whitespace-only string returns DEFAULT_SHORTCUTS with no warnings", () => {
		const result = parseShortcutConfig("   \n  ");
		expect(result.shortcuts).toEqual(DEFAULT_SHORTCUTS);
		expect(result.warnings).toHaveLength(0);
	});

	test("full valid overrides replace all three shortcuts", () => {
		const result = parseShortcutConfig(
			'{"shortcuts":{"editNotes":"ctrl+e","queueStep":"alt+down","queueToggleAuto":"ctrl+g"}}',
		);
		expect(result.shortcuts).toEqual({
			editNotes: "ctrl+e",
			queueStep: "alt+down",
			queueToggleAuto: "ctrl+g",
		});
		expect(result.warnings).toHaveLength(0);
	});

	test("partial override keeps defaults for unspecified keys", () => {
		const result = parseShortcutConfig(
			'{"shortcuts":{"queueToggleAuto":"ctrl+g"}}',
		);
		expect(result.shortcuts.queueToggleAuto).toBe("ctrl+g");
		expect(result.shortcuts.editNotes).toBe(DEFAULT_SHORTCUTS.editNotes);
		expect(result.shortcuts.queueStep).toBe(DEFAULT_SHORTCUTS.queueStep);
		expect(result.warnings).toHaveLength(0);
	});

	test("invalid JSON returns defaults with one warning containing 'Invalid config.json'", () => {
		const result = parseShortcutConfig("{not json");
		expect(result.shortcuts).toEqual(DEFAULT_SHORTCUTS);
		expect(result.warnings).toHaveLength(1);
		expect(
			result.warnings.some((w) => w.startsWith("Invalid config.json:")),
		).toBe(true);
	});

	test("bad modifier prefix falls back to default and warns mentioning the key", () => {
		const result = parseShortcutConfig(
			'{"shortcuts":{"queueStep":"bogus+down"}}',
		);
		expect(result.shortcuts.queueStep).toBe(DEFAULT_SHORTCUTS.queueStep);
		expect(result.warnings.some((w) => w.includes("queueStep"))).toBe(true);
	});

	test("trailing '+' (ctrl+) falls back to default with warning", () => {
		const result = parseShortcutConfig('{"shortcuts":{"editNotes":"ctrl+"}}');
		expect(result.shortcuts.editNotes).toBe(DEFAULT_SHORTCUTS.editNotes);
		expect(result.warnings.some((w) => w.includes("editNotes"))).toBe(true);
	});

	test("trailing '+' (ctrl+shift+) falls back to default with warning", () => {
		const result = parseShortcutConfig(
			'{"shortcuts":{"editNotes":"ctrl+shift+"}}',
		);
		expect(result.shortcuts.editNotes).toBe(DEFAULT_SHORTCUTS.editNotes);
		expect(result.warnings.some((w) => w.includes("editNotes"))).toBe(true);
	});

	test("non-string value falls back to default with warning", () => {
		const result = parseShortcutConfig('{"shortcuts":{"editNotes":5}}');
		expect(result.shortcuts.editNotes).toBe(DEFAULT_SHORTCUTS.editNotes);
		expect(result.warnings.some((w) => w.includes("editNotes"))).toBe(true);
	});

	test("normalizes uppercase/mixed-case input to lowercase", () => {
		const result = parseShortcutConfig(
			'{"shortcuts":{"queueToggleAuto":"CTRL+Shift+Down"}}',
		);
		expect(result.shortcuts.queueToggleAuto).toBe("ctrl+shift+down");
		expect(result.warnings).toHaveLength(0);
	});

	test("modifier-only key (e.g. 'ctrl') is rejected with warning", () => {
		const result = parseShortcutConfig('{"shortcuts":{"editNotes":"ctrl"}}');
		expect(result.shortcuts.editNotes).toBe(DEFAULT_SHORTCUTS.editNotes);
		expect(result.warnings.some((w) => w.includes("editNotes"))).toBe(true);
	});

	test("top-level JSON value that is not an object silently returns defaults", () => {
		const result = parseShortcutConfig('"just a string"');
		expect(result.shortcuts).toEqual(DEFAULT_SHORTCUTS);
		expect(result.warnings).toHaveLength(0);
	});
});

describe("humanizeKey", () => {
	test('"ctrl+n" → "Ctrl+N"', () => {
		expect(humanizeKey("ctrl+n")).toBe("Ctrl+N");
	});

	test('"ctrl+shift+down" → "Ctrl+Shift+↓"', () => {
		expect(humanizeKey("ctrl+shift+down")).toBe("Ctrl+Shift+↓");
	});

	test('"ctrl+down" → "Ctrl+↓"', () => {
		expect(humanizeKey("ctrl+down")).toBe("Ctrl+↓");
	});

	test('"alt+enter" → "Alt+Enter"', () => {
		expect(humanizeKey("alt+enter")).toBe("Alt+Enter");
	});

	test("special base tokens map to symbols/words", () => {
		expect(humanizeKey("ctrl+up")).toBe("Ctrl+↑");
		expect(humanizeKey("alt+left")).toBe("Alt+←");
		expect(humanizeKey("shift+right")).toBe("Shift+→");
		expect(humanizeKey("ctrl+space")).toBe("Ctrl+Space");
		expect(humanizeKey("ctrl+tab")).toBe("Ctrl+Tab");
	});

	test("non-special multi-char base token gets first letter capitalized", () => {
		expect(humanizeKey("ctrl+delete")).toBe("Ctrl+Delete");
	});
});

describe("queueHint", () => {
	test("shows edit, step, and toggle keys when auto is off", () => {
		expect(queueHint(DEFAULT_SHORTCUTS, false)).toBe(
			"(Ctrl+N · Ctrl+↓ queue · Ctrl+Shift+↓ auto)",
		);
	});

	test("marks auto-run active with a trailing ▶", () => {
		expect(queueHint(DEFAULT_SHORTCUTS, true)).toBe(
			"(Ctrl+N · Ctrl+↓ queue · Ctrl+Shift+↓ auto ▶)",
		);
	});

	test("humanizes custom configured keys", () => {
		expect(
			queueHint(
				{
					editNotes: "ctrl+e",
					queueStep: "alt+down",
					queueToggleAuto: "ctrl+g",
				},
				false,
			),
		).toBe("(Ctrl+E · Alt+↓ queue · Ctrl+G auto)");
	});

	test("appends an unlock instruction when blocked at a barrier", () => {
		expect(queueHint(DEFAULT_SHORTCUTS, false, true)).toBe(
			"(Ctrl+N · Ctrl+↓ queue · Ctrl+Shift+↓ auto) ⏸ paused — Ctrl+↓ passes ---",
		);
	});
});
