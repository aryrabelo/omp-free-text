/**
 * Pure rendering of the notes widget shown below the status line.
 *
 * OMP's `setWidget` caps content at 10 lines, so the output is always clamped.
 * The first line is a title/hint; the rest is a preview of the latest note.
 */

/** Default title shown on the widget's first line. */
export const DEFAULT_TITLE = "notes (Ctrl+N)";

/** Shown when the note is empty. */
export const EMPTY_HINT = "(empty - press Ctrl+N or /note to write)";

export interface WidgetOptions {
  /** First line of the widget. */
  title?: string;
  /** Hard cap on total lines (also clamped to 10 by OMP). */
  maxLines?: number;
}

/**
 * Render the widget as a string array: a title line followed by the trailing
 * lines of `content` (most recent), clamped to `maxLines` (max 10).
 */
export function renderWidgetLines(content: string, options: WidgetOptions = {}): string[] {
  const title = options.title ?? DEFAULT_TITLE;
  const maxLines = Math.max(1, Math.min(options.maxLines ?? 10, 10));
  const bodyBudget = maxLines - 1;

  const trimmed = content.replace(/\s+$/, "");
  if (trimmed.length === 0 || bodyBudget === 0) {
    const lines = trimmed.length === 0 ? [title, EMPTY_HINT] : [title];
    return lines.slice(0, maxLines);
  }

  const allLines = trimmed.split("\n");
  const tail = allLines.slice(Math.max(allLines.length - bodyBudget, 0));
  return [title, ...tail];
}
