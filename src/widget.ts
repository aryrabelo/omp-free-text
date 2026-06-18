/**
 * Pure rendering of the notes widget shown below the status line.
 *
 * OMP's `setWidget` caps content at 10 lines, so the output is always clamped.
 * Layout: an optional top-border line, then the note body (most recent lines),
 * then a dimmed shortcut hint as the final line, without the gutter glyph.
 */

/** Trailing shortcut hint shown on the widget's last line. */
export const SHORTCUT_HINT = "(Ctrl+N)";

/** Shown as the body when the note is empty. */
export const EMPTY_HINT = "(empty - press Ctrl+N or /note to write)";

/** Styling hooks applied per line. Default is plain (identity) for tests/non-UI. */
export interface WidgetStyle {
  /** Full styled top-border line (e.g. `╭──`); "" disables the header. */
  topBorder: string;
  /** Style the empty-state body line. */
  hint: (text: string) => string;
  /** Style a note-body line. */
  body: (text: string) => string;
  /** Style the trailing shortcut hint. */
  shortcut: (text: string) => string;
  /** Leading glyph (already styled) prefixed to every body line; "" disables the gutter. */
  gutter: string;
}

/** No-op styling: identical output to a plain string array. */
export const PLAIN_STYLE: WidgetStyle = {
  topBorder: "",
  hint: (t: string): string => t,
  body: (t: string): string => t,
  shortcut: (t: string): string => t,
  gutter: "",
};

export interface WidgetOptions {
  /** Trailing shortcut hint line. */
  shortcut?: string;
  /** Hard cap on total lines (also clamped to 10 by OMP). */
  maxLines?: number;
  /** Per-line styling; defaults to {@link PLAIN_STYLE}. */
  style?: WidgetStyle;
}

/**
 * Render the widget as a string array: an optional top-border line, the trailing
 * lines of `content` (most recent), then a shortcut-hint line, clamped to
 * `maxLines` (max 10). Body lines get the styled gutter glyph; the border and
 * shortcut lines do not.
 */
export function renderWidgetLines(content: string, options: WidgetOptions = {}): string[] {
  const shortcut = options.shortcut ?? SHORTCUT_HINT;
  const style = options.style ?? PLAIN_STYLE;
  const maxLines = Math.max(1, Math.min(options.maxLines ?? 10, 10));
  const gutter = style.gutter ? `${style.gutter} ` : "";
  const footer = style.shortcut(shortcut);
  const head = style.topBorder ? [style.topBorder] : [];
  const bodyBudget = Math.max(maxLines - head.length - 1, 0);

  const trimmed = content.replace(/\s+$/, "");
  if (trimmed.length === 0 || bodyBudget === 0) {
    const out = [...head];
    if (trimmed.length === 0 && bodyBudget > 0) out.push(gutter + style.hint(EMPTY_HINT));
    out.push(footer);
    return out.slice(0, maxLines);
  }

  const allLines = trimmed.split("\n");
  const tail = allLines.slice(Math.max(allLines.length - bodyBudget, 0));
  return [...head, ...tail.map((l) => gutter + style.body(l)), footer];
}
