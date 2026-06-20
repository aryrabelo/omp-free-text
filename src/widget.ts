/**
 * Pure rendering of the notes widget shown below the status line.
 *
 * OMP's `setWidget` caps content at 10 lines, so the output is always clamped.
 * Layout: an optional top-border line, then the note body (most recent lines),
 * then a dimmed shortcut hint as the final line, without the gutter glyph.
 */

import { parseTaskLine, type TaskState } from "./queue";

/** Trailing shortcut hint shown on the widget's last line. */
export const SHORTCUT_HINT = "(Ctrl+N)";

/** Shown as the body when the note is empty. */
export const EMPTY_HINT = "(empty - press Ctrl+N or /note to write)";

/** Glyph for a pending (unchecked) task — U+2610. */
const GLYPH_PENDING = "☐";
/** Glyph for an in-flight (dispatched) task — U+25B8. */
const GLYPH_INFLIGHT = "▸";
/** Glyph for a completed task — U+2713. */
const GLYPH_DONE = "✓";
/** Connector glyph prefixed to a multi-line prompt's continuation lines — U+2506. */
const GLYPH_CONTINUATION = "┆";
/** A continuation line: leading whitespace then content (mirrors the queue's rule). */
const CONTINUATION = /^\s+\S/;

/** Styling hooks applied per line. Default is plain (identity) for tests/non-UI. */
export interface WidgetStyle {
	/** Full styled title line (e.g. bold "Notes"); "" disables the title block (title + its leading blank). */
	title: string;
	/** Raw tree-hook glyph (e.g. `└`) placed on the first body row, folded into the row's styler so it takes the row color; "" disables tree prefixes. */
	hook: string;
	/** Raw indent prefixed to every body and footer row (e.g. "  "); "" for none. */
	indent: string;
	/** Style the empty-state body line. */
	hint: (text: string) => string;
	/** Style a note-body prose line. */
	body: (text: string) => string;
	/** Style the trailing shortcut hint. */
	shortcut: (text: string) => string;
	/** Style a pending task line (receives the full display string, e.g. "└ ☐ buy milk"). */
	taskPending: (text: string) => string;
	/** Style an in-flight task line (receives the full display string, e.g. "▸ buy milk"). */
	taskInflight: (text: string) => string;
	/** Color a done task line (color only — strikethrough is applied to the text via {@link WidgetStyle.strike}). */
	taskDone: (text: string) => string;
	/** Strike through done-task TEXT only (not the tree prefix or glyph), mirroring OMP's done todos. */
	strike: (text: string) => string;
	/** Style a multi-line prompt continuation line (receives the full string, e.g. "┆ detail"). */
	continuation: (text: string) => string;
}

/** No-op styling: identical output to a plain string array. */
export const PLAIN_STYLE: WidgetStyle = {
	title: "",
	hook: "",
	indent: "",
	hint: (t: string): string => t,
	body: (t: string): string => t,
	shortcut: (t: string): string => t,
	taskPending: (t: string): string => t,
	taskInflight: (t: string): string => t,
	taskDone: (t: string): string => t,
	strike: (t: string): string => t,
	continuation: (t: string): string => t,
};

export interface WidgetOptions {
	/** Trailing shortcut hint line. */
	shortcut?: string;
	/** Hard cap on total lines (also clamped to 10 by OMP). */
	maxLines?: number;
	/** Per-line styling; defaults to {@link PLAIN_STYLE}. */
	style?: WidgetStyle;
	/** Max number of done (strikethrough) task blocks shown; older ones are dropped. Default 2. */
	maxDone?: number;
}

/** Glyph for a task state. */
function glyphFor(state: TaskState): string {
	if (state === "pending") return GLYPH_PENDING;
	if (state === "inflight") return GLYPH_INFLIGHT;
	return GLYPH_DONE;
}

/**
 * Compose one styled body row: `prefix` + `glyph` + text, colored by `state`'s styler
 * (the `continuation` styler when `state` is null). Done rows strike ONLY the text
 * (not the prefix/glyph), mirroring OMP's done todos.
 */
function composeRow(
	style: WidgetStyle,
	prefix: string,
	glyph: string,
	text: string,
	state: TaskState | null,
): string {
	const content = `${prefix}${glyph} ${state === "done" ? style.strike(text) : text}`;
	if (state === "pending") return style.taskPending(content);
	if (state === "inflight") return style.taskInflight(content);
	if (state === "done") return style.taskDone(content);
	return style.continuation(content);
}

/**
 * Tree prefix for a body row, mirroring OMP's HUD widgets: `indent` + a `└` hook on the
 * first row (space after) and aligned blanks on the rest. Returns just the indent when the
 * style disables the hook (e.g. {@link PLAIN_STYLE}), so non-UI output stays unprefixed.
 */
function rowPrefix(style: WidgetStyle, first: boolean): string {
	if (style.hook === "") return style.indent;
	return style.indent + (first ? `${style.hook} ` : "  ");
}

/**
 * Render body lines, tracking each multi-line prompt's head state so its indented
 * continuation lines inherit the head's styling (pending block reads active, done block dim+struck).
 * Each row gets a {@link rowPrefix}; task lines render with their glyph, continuation lines with
 * the `┆` connector, and other prose falls to the body styler.
 */
function renderBody(lines: string[], style: WidgetStyle): string[] {
	let parent: TaskState | null = null;
	return lines.map((line, i): string => {
		const prefix = rowPrefix(style, i === 0);
		const { state, text } = parseTaskLine(line);
		if (state !== null) {
			parent = state;
			return composeRow(style, prefix, glyphFor(state), text, state);
		}
		if (CONTINUATION.test(line))
			return composeRow(style, prefix, GLYPH_CONTINUATION, text, parent);
		parent = null;
		return style.body(prefix + line);
	});
}

/**
 * Drop all but the last `maxDone` done (strikethrough) task blocks. A done block is a
 * `- [x]` line plus its indented continuation lines; pending/in-flight/prose lines are kept.
 */
function collapseDoneBlocks(lines: string[], maxDone: number): string[] {
	const doneStarts: number[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (parseTaskLine(lines[i] ?? "").state === "done") doneStarts.push(i);
	}
	if (doneStarts.length <= maxDone) return lines;
	const drop = new Set<number>();
	for (const start of doneStarts.slice(0, doneStarts.length - maxDone)) {
		drop.add(start);
		for (
			let j = start + 1;
			j < lines.length && CONTINUATION.test(lines[j] ?? "");
			j++
		)
			drop.add(j);
	}
	return lines.filter((_, i): boolean => !drop.has(i));
}

/**
 * Render the widget as a string array, mirroring OMP's HUD widgets (Todos/Subagents):
 * an optional title block (a leading blank + the styled title), the trailing lines of
 * `content` (most recent, done-capped), then an indented shortcut-hint line. Clamped to
 * `maxLines` (max 10). The title block and the hint are absent under {@link PLAIN_STYLE}.
 */
export function renderWidgetLines(
	content: string,
	options: WidgetOptions = {},
): string[] {
	const style = options.style ?? PLAIN_STYLE;
	const maxLines = Math.max(1, Math.min(options.maxLines ?? 10, 10));
	const footer =
		style.indent + style.shortcut(options.shortcut ?? SHORTCUT_HINT);
	const head = style.title === "" ? [] : ["", style.title];
	const bodyBudget = Math.max(maxLines - head.length - 1, 0);
	const trimmed = content.replace(/\s+$/, "");

	const body = renderWidgetBody(
		trimmed,
		bodyBudget,
		options.maxDone ?? 2,
		style,
	);
	return [...head, ...body, footer].slice(0, maxLines);
}

/** Body lines for the widget: indented empty-hint, or the done-capped tail of the note. */
function renderWidgetBody(
	trimmed: string,
	bodyBudget: number,
	maxDone: number,
	style: WidgetStyle,
): string[] {
	if (bodyBudget === 0) return [];
	if (trimmed.length === 0) return [style.indent + style.hint(EMPTY_HINT)];
	const capped = collapseDoneBlocks(trimmed.split("\n"), Math.max(0, maxDone));
	const tail = capped.slice(Math.max(capped.length - bodyBudget, 0));
	return renderBody(tail, style);
}
