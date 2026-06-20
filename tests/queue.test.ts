import { describe, expect, test } from "bun:test";
import {
	appendQueue,
	appendTask,
	completeInflight,
	findHead,
	markInflight,
	normalizeQueue,
	parseTaskLine,
	removeBarrier,
} from "../src/queue";

describe("parseTaskLine", () => {
	test("pending checkbox — space state char", () => {
		expect(parseTaskLine("- [ ] do the thing")).toEqual({
			state: "pending",
			text: "do the thing",
		});
	});

	test("pending checkbox — asterisk bullet prefix", () => {
		expect(parseTaskLine("* [ ] another task")).toEqual({
			state: "pending",
			text: "another task",
		});
	});

	test("inflight checkbox", () => {
		expect(parseTaskLine("- [>] running now")).toEqual({
			state: "inflight",
			text: "running now",
		});
	});

	test("done checkbox — lowercase x", () => {
		expect(parseTaskLine("- [x] finished")).toEqual({
			state: "done",
			text: "finished",
		});
	});

	test("done checkbox — uppercase X", () => {
		expect(parseTaskLine("- [X] also finished")).toEqual({
			state: "done",
			text: "also finished",
		});
	});

	test("non-checkbox plain line → state null, text is trimmed line", () => {
		expect(parseTaskLine("  plain text  ")).toEqual({
			state: null,
			text: "plain text",
		});
	});

	test("non-checkbox dash bullet → state null, marker stripped from text", () => {
		expect(parseTaskLine("- bullet item")).toEqual({
			state: null,
			text: "bullet item",
		});
	});

	test("non-checkbox asterisk bullet → state null, marker stripped", () => {
		expect(parseTaskLine("* another bullet")).toEqual({
			state: null,
			text: "another bullet",
		});
	});

	test("operates on the trimmed line", () => {
		expect(parseTaskLine("  - [ ] padded task  ")).toEqual({
			state: "pending",
			text: "padded task",
		});
	});
});

describe("findHead", () => {
	test("empty note → empty", () => {
		expect(findHead("")).toEqual({ kind: "empty" });
	});

	test("all-blank note → empty", () => {
		expect(findHead("   \n\n\t\n")).toEqual({ kind: "empty" });
	});

	test("first checkbox-pending is the head", () => {
		expect(findHead("- [ ] first\n- [ ] second")).toEqual({
			kind: "prompt",
			line: 0,
			text: "first",
		});
	});

	test("skips done checkbox (lowercase x)", () => {
		expect(findHead("- [x] done\n- [ ] next")).toEqual({
			kind: "prompt",
			line: 1,
			text: "next",
		});
	});

	test("skips done checkbox (uppercase X)", () => {
		expect(findHead("- [X] done\n- [ ] next")).toEqual({
			kind: "prompt",
			line: 1,
			text: "next",
		});
	});

	test("skips inflight checkbox", () => {
		expect(findHead("- [>] running\n- [ ] pending")).toEqual({
			kind: "prompt",
			line: 1,
			text: "pending",
		});
	});

	test("barrier before any pending → barrier is the head", () => {
		expect(findHead("---\n- [ ] after")).toEqual({ kind: "barrier", line: 0 });
	});

	test("barrier after done/inflight lines", () => {
		expect(findHead("- [x] done\n- [>] running\n---\n- [ ] after")).toEqual({
			kind: "barrier",
			line: 2,
		});
	});

	test("heading (PROSE) is skipped", () => {
		expect(findHead("# heading\n- [ ] task")).toEqual({
			kind: "prompt",
			line: 1,
			text: "task",
		});
	});

	test("blockquote (PROSE) is skipped", () => {
		expect(findHead("> quote\n- [ ] task")).toEqual({
			kind: "prompt",
			line: 1,
			text: "task",
		});
	});

	test("blank lines before the first prompt are skipped", () => {
		expect(findHead("\n\n- [ ] third")).toEqual({
			kind: "prompt",
			line: 2,
			text: "third",
		});
	});

	test("empty-text checkbox is skipped", () => {
		expect(findHead("- [ ] \n- [ ] real")).toEqual({
			kind: "prompt",
			line: 1,
			text: "real",
		});
	});

	test("empty-text checkbox alone → empty", () => {
		expect(findHead("- [ ]")).toEqual({ kind: "empty" });
	});

	test("plain text line is treated as a pending prompt", () => {
		expect(findHead("just plain text")).toEqual({
			kind: "prompt",
			line: 0,
			text: "just plain text",
		});
	});

	test("bullet without checkbox → pending prompt with marker stripped", () => {
		expect(findHead("- bare bullet")).toEqual({
			kind: "prompt",
			line: 0,
			text: "bare bullet",
		});
	});

	test("all done/inflight → empty", () => {
		expect(findHead("- [x] a\n- [>] b\n- [X] c")).toEqual({ kind: "empty" });
	});

	test("CRLF tolerance: barrier with trailing CR", () => {
		expect(findHead("---\r")).toEqual({ kind: "barrier", line: 0 });
	});

	test("barrier with trailing whitespace is still a barrier", () => {
		expect(findHead("---  ")).toEqual({ kind: "barrier", line: 0 });
	});

	test("indented lines after a prompt are joined as one multi-line prompt", () => {
		expect(findHead("Esse é o prompt\n  info one\n  info two")).toEqual({
			kind: "prompt",
			line: 0,
			text: "Esse é o prompt\ninfo one\ninfo two",
		});
	});

	test("a blank line ends the continuation group", () => {
		expect(findHead("prompt a\n  detail\n\nprompt b")).toEqual({
			kind: "prompt",
			line: 0,
			text: "prompt a\ndetail",
		});
	});

	test("a non-indented line ends the continuation group", () => {
		expect(findHead("prompt a\n  detail\nprompt b")).toEqual({
			kind: "prompt",
			line: 0,
			text: "prompt a\ndetail",
		});
	});

	test("continuation lines are left-trimmed but keep inner content", () => {
		expect(findHead("- [ ] head\n    deep indent")).toEqual({
			kind: "prompt",
			line: 0,
			text: "head\ndeep indent",
		});
	});

	test("an orphan indented line (no head above) is skipped", () => {
		expect(findHead("  orphan\n- [ ] real")).toEqual({
			kind: "prompt",
			line: 1,
			text: "real",
		});
	});

	test("an indented barrier does not get swallowed as continuation", () => {
		expect(findHead("prompt\n  detail\n---")).toEqual({
			kind: "prompt",
			line: 0,
			text: "prompt\ndetail",
		});
	});
});

describe("markInflight", () => {
	test("rewrites a checkbox-pending line to in-flight", () => {
		expect(markInflight("- [ ] do the thing", 0)).toBe("- [>] do the thing");
	});

	test("rewrites a plain text line to in-flight", () => {
		expect(markInflight("plain text", 0)).toBe("- [>] plain text");
	});

	test("rewrites a dash bullet to in-flight, stripping the marker", () => {
		expect(markInflight("- bullet item", 0)).toBe("- [>] bullet item");
	});

	test("rewrites an asterisk bullet to in-flight, stripping the marker", () => {
		expect(markInflight("* bullet item", 0)).toBe("- [>] bullet item");
	});

	test("targets the correct line in a multi-line note", () => {
		expect(markInflight("- [ ] first\n- [ ] second\n- [ ] third", 1)).toBe(
			"- [ ] first\n- [>] second\n- [ ] third",
		);
	});

	test("out-of-range positive index → note unchanged", () => {
		const note = "- [ ] only";
		expect(markInflight(note, 5)).toBe(note);
	});

	test("negative index → note unchanged", () => {
		const note = "- [ ] only";
		expect(markInflight(note, -1)).toBe(note);
	});

	test("extracts text from CHECKBOX g2 regardless of the current state char", () => {
		expect(markInflight("- [x] done item", 0)).toBe("- [>] done item");
	});
});

describe("completeInflight", () => {
	test("marks a single in-flight line as done", () => {
		expect(completeInflight("- [>] running")).toBe("- [x] running");
	});

	test("marks multiple in-flight lines as done, leaves other lines untouched", () => {
		expect(completeInflight("- [x] a\n- [>] b\n- [>] c\n- [ ] d")).toBe(
			"- [x] a\n- [x] b\n- [x] c\n- [ ] d",
		);
	});

	test("no in-flight lines → returns the same string value", () => {
		const note = "- [ ] pending\n- [x] done\n---";
		expect(completeInflight(note)).toBe(note);
	});

	test("preserves non-queue lines (barrier, heading) unchanged", () => {
		expect(completeInflight("---\n- [>] task\n# heading")).toBe(
			"---\n- [x] task\n# heading",
		);
	});

	test("asterisk-prefixed in-flight line is also completed", () => {
		expect(completeInflight("* [>] asterisk task")).toBe("- [x] asterisk task");
	});
});

describe("normalizeQueue", () => {
	test("plain text line → checkbox pending", () => {
		expect(normalizeQueue("do the thing")).toBe("- [ ] do the thing");
	});

	test("dash bullet without checkbox → checkbox pending", () => {
		expect(normalizeQueue("- bare bullet")).toBe("- [ ] bare bullet");
	});

	test("asterisk bullet without checkbox → checkbox pending", () => {
		expect(normalizeQueue("* bare bullet")).toBe("- [ ] bare bullet");
	});

	test("existing pending checkbox → unchanged", () => {
		expect(normalizeQueue("- [ ] already")).toBe("- [ ] already");
	});

	test("existing inflight checkbox → unchanged", () => {
		expect(normalizeQueue("- [>] running")).toBe("- [>] running");
	});

	test("existing done checkbox (x) → unchanged", () => {
		expect(normalizeQueue("- [x] done")).toBe("- [x] done");
	});

	test("existing done checkbox (X) → unchanged", () => {
		expect(normalizeQueue("- [X] done")).toBe("- [X] done");
	});

	test("heading → unchanged", () => {
		expect(normalizeQueue("# section heading")).toBe("# section heading");
	});

	test("blockquote → unchanged", () => {
		expect(normalizeQueue("> a quote")).toBe("> a quote");
	});

	test("barrier → unchanged", () => {
		expect(normalizeQueue("---")).toBe("---");
	});

	test("blank line → unchanged", () => {
		expect(normalizeQueue("")).toBe("");
	});

	test("blank lines between content are preserved", () => {
		expect(normalizeQueue("plain\n\nbullet")).toBe(
			"- [ ] plain\n\n- [ ] bullet",
		);
	});

	test("mixed note: heading, checkbox, bullet, plain all handled correctly", () => {
		const input = "# heading\n- [ ] task\n- bare bullet\nplain line";
		const output = "# heading\n- [ ] task\n- [ ] bare bullet\n- [ ] plain line";
		expect(normalizeQueue(input)).toBe(output);
	});

	test("indented continuation line is kept verbatim, not turned into a checkbox", () => {
		expect(normalizeQueue("head\n  detail")).toBe("- [ ] head\n  detail");
	});

	test("indented line under a checkbox head stays indented prose", () => {
		const input = "- [ ] head\n  more context\n  even more";
		expect(normalizeQueue(input)).toBe(input);
	});
});

describe("appendTask", () => {
	test("empty note → just the new task line", () => {
		expect(appendTask("", "new task")).toBe("- [ ] new task");
	});

	test("note without trailing newline → exactly one newline before new task", () => {
		expect(appendTask("- [ ] existing", "new task")).toBe(
			"- [ ] existing\n- [ ] new task",
		);
	});

	test("note with trailing newline → new task appended directly after it", () => {
		expect(appendTask("- [ ] existing\n", "new task")).toBe(
			"- [ ] existing\n- [ ] new task",
		);
	});

	test("empty text → note unchanged", () => {
		const note = "- [ ] existing";
		expect(appendTask(note, "")).toBe(note);
	});

	test("whitespace-only text → note unchanged", () => {
		const note = "- [ ] existing";
		expect(appendTask(note, "   ")).toBe(note);
	});

	test("text is trimmed before appending", () => {
		expect(appendTask("", "  padded  ")).toBe("- [ ] padded");
	});
});

describe("removeBarrier", () => {
	test("deletes the barrier line entirely", () => {
		expect(removeBarrier("before\n---\nafter", 1)).toBe("before\nafter");
	});

	test("out-of-range positive index → unchanged", () => {
		expect(removeBarrier("a\nb", 9)).toBe("a\nb");
	});

	test("negative index → unchanged", () => {
		expect(removeBarrier("a\nb", -1)).toBe("a\nb");
	});
});

describe("appendQueue", () => {
	test("renders one prompt as a pending checkbox", () => {
		expect(appendQueue("", [{ prompt: "do a thing" }])).toBe(
			"- [ ] do a thing",
		);
	});

	test("renders details as two-space-indented continuation lines", () => {
		expect(appendQueue("", [{ prompt: "p", details: ["one", "two"] }])).toBe(
			"- [ ] p\n  one\n  two",
		);
	});

	test("barrierAfter renders a --- barrier line after the step", () => {
		expect(
			appendQueue("", [{ prompt: "p", barrierAfter: true }, { prompt: "q" }]),
		).toBe("- [ ] p\n---\n- [ ] q");
	});

	test("appends below existing content with exactly one separating newline", () => {
		expect(appendQueue("- [ ] old\n", [{ prompt: "new" }])).toBe(
			"- [ ] old\n- [ ] new",
		);
	});

	test("skips empty-prompt steps and trims prompt and details", () => {
		expect(
			appendQueue("", [
				{ prompt: "  " },
				{ prompt: "  keep  ", details: ["  d  ", "   "] },
			]),
		).toBe("- [ ] keep\n  d");
	});

	test("no rendered lines → note returned unchanged", () => {
		expect(appendQueue("- [ ] only", [{ prompt: "" }])).toBe("- [ ] only");
	});
});
