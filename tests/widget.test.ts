import { describe, expect, test } from "bun:test";
import { DEFAULT_TITLE, EMPTY_HINT, renderWidgetLines } from "../src/widget";

describe("renderWidgetLines", () => {
  test("shows title and hint when the note is empty", () => {
    expect(renderWidgetLines("")).toEqual([DEFAULT_TITLE, EMPTY_HINT]);
    expect(renderWidgetLines("   \n  ")).toEqual([DEFAULT_TITLE, EMPTY_HINT]);
  });

  test("shows title plus the note body for short notes", () => {
    expect(renderWidgetLines("one\ntwo")).toEqual([DEFAULT_TITLE, "one", "two"]);
  });

  test("keeps only the trailing lines and never exceeds 10 lines", () => {
    const content = Array.from({ length: 30 }, (_, i) => `line${i + 1}`).join("\n");
    const lines = renderWidgetLines(content);
    expect(lines.length).toBe(10);
    expect(lines[0]).toBe(DEFAULT_TITLE);
    expect(lines[1]).toBe("line22");
    expect(lines.at(-1)).toBe("line30");
  });

  test("respects a custom title and a smaller maxLines", () => {
    const lines = renderWidgetLines("a\nb\nc\nd", { title: "T", maxLines: 3 });
    expect(lines).toEqual(["T", "c", "d"]);
  });

  test("clamps maxLines above 10 back down to 10", () => {
    const content = Array.from({ length: 30 }, (_, i) => `l${i}`).join("\n");
    expect(renderWidgetLines(content, { maxLines: 50 }).length).toBe(10);
  });
});
