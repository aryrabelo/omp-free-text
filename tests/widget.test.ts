import { describe, expect, test } from "bun:test";
import { EMPTY_HINT, PLAIN_STYLE, renderWidgetLines, SHORTCUT_HINT, type WidgetStyle } from "../src/widget";

describe("renderWidgetLines", () => {
  test("shows the empty hint then the shortcut when the note is empty", () => {
    expect(renderWidgetLines("")).toEqual([EMPTY_HINT, SHORTCUT_HINT]);
    expect(renderWidgetLines("   \n  ")).toEqual([EMPTY_HINT, SHORTCUT_HINT]);
  });

  test("shows the note body first, then the shortcut", () => {
    expect(renderWidgetLines("one\ntwo")).toEqual(["one", "two", SHORTCUT_HINT]);
  });

  test("keeps only the trailing lines and never exceeds 10 lines", () => {
    const content = Array.from({ length: 30 }, (_, i) => `line${i + 1}`).join("\n");
    const lines = renderWidgetLines(content);
    expect(lines.length).toBe(10);
    expect(lines[0]).toBe("line22");
    expect(lines.at(-1)).toBe(SHORTCUT_HINT);
    expect(lines.at(-2)).toBe("line30");
  });

  test("respects a custom shortcut and a smaller maxLines", () => {
    const lines = renderWidgetLines("a\nb\nc\nd", { shortcut: "S", maxLines: 3 });
    expect(lines).toEqual(["c", "d", "S"]);
  });

  test("clamps maxLines above 10 back down to 10", () => {
    const content = Array.from({ length: 30 }, (_, i) => `l${i}`).join("\n");
    expect(renderWidgetLines(content, { maxLines: 50 }).length).toBe(10);
  });

  test("applies the top border, gutter, and per-line styling when a style is given", () => {
    const style: WidgetStyle = {
      topBorder: "T--",
      hint: (t: string): string => `H<${t}>`,
      body: (t: string): string => `B<${t}>`,
      shortcut: (t: string): string => `S<${t}>`,
      gutter: "|",
    };
    expect(renderWidgetLines("", { style })).toEqual(["T--", `| H<${EMPTY_HINT}>`, `S<${SHORTCUT_HINT}>`]);
    expect(renderWidgetLines("one\ntwo", { style })).toEqual(["T--", "| B<one>", "| B<two>", `S<${SHORTCUT_HINT}>`]);
  });

  test("reserves room for the top border within maxLines", () => {
    const style: WidgetStyle = { ...PLAIN_STYLE, topBorder: "T--" };
    const content = Array.from({ length: 30 }, (_, i) => `line${i + 1}`).join("\n");
    const lines = renderWidgetLines(content, { style });
    expect(lines.length).toBe(10);
    expect(lines[0]).toBe("T--");
    expect(lines[1]).toBe("line23");
    expect(lines.at(-1)).toBe(SHORTCUT_HINT);
    expect(lines.at(-2)).toBe("line30");
  });

  test("PLAIN_STYLE leaves output unprefixed and unstyled", () => {
    expect(renderWidgetLines("one", { style: PLAIN_STYLE })).toEqual(["one", SHORTCUT_HINT]);
  });
});
