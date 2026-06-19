import { describe, expect, test } from "bun:test";
import { resolveCloseAction } from "../src/editor";

describe("resolveCloseAction", () => {
	test("submit always saves, even when nothing changed", () => {
		expect(resolveCloseAction("a", "a", true)).toBe("save");
		expect(resolveCloseAction("a", "b", true)).toBe("save");
		expect(resolveCloseAction("", "", true)).toBe("save");
	});

	test("escape with no change discards silently", () => {
		expect(resolveCloseAction("a", "a", false)).toBe("discard");
		expect(resolveCloseAction("", "", false)).toBe("discard");
	});

	test("escape with unsaved changes asks the user", () => {
		expect(resolveCloseAction("a", "b", false)).toBe("ask");
		expect(resolveCloseAction("", "typed", false)).toBe("ask");
		expect(resolveCloseAction("kept\nfoo", "kept", false)).toBe("ask");
	});
});
