/**
 * Pure parsing of the free-text note as a prompt queue (checkbox model).
 *
 * No OMP / fs / TUI imports. The note IS the queue: lines are read top-to-bottom
 * (FIFO). A `- [ ] text` line is PENDING; `- [>] text` is IN-FLIGHT; `- [x] text`
 * is DONE. A line of three-or-more dashes alone (`---`) is a human-in-the-loop
 * barrier. Every other non-blank, non-prose line is treated as PENDING for
 * robustness so dispatch works before normalization tidies it.
 */

/** Three-or-more dashes alone on a trimmed line mark a human-in-the-loop barrier. */
const BARRIER = /^-{3,}$/;
/** Markdown checkbox: g1 = state char (' ' | '>' | 'x' | 'X'), g2 = payload text. */
const CHECKBOX = /^[-*]\s+\[([ xX>])\]\s*(.*)$/;
/** Heading or blockquote prefix — prose lines, never a prompt. */
const PROSE = /^(#{1,6}\s|>\s)/;
/** Plain bullet without a checkbox: g1 = content after the marker. */
const BULLET = /^[-*]\s+(.*)$/;
/** In-flight checkbox line: g1 = payload text. */
const INFLIGHT = /^[-*]\s+\[>\]\s*(.*)$/;
/** A continuation line: leading whitespace then content — belongs to the prompt above it. */
const CONTINUATION = /^\s+\S/;

/**
 * Maps a non-pending checkbox state char to its {@link TaskState}.
 * Absent key (the space char) means pending.
 */
const STATE_MAP: Record<string, TaskState> = {
	">": "inflight",
	x: "done",
	X: "done",
};

/** Checkbox-based state of a single queue line. */
export type TaskState = "pending" | "inflight" | "done";

/** The active head of the queue. */
export type QueueHead =
	| { kind: "prompt"; line: number; text: string }
	| { kind: "barrier"; line: number }
	| { kind: "empty" };

// ─── private helpers ────────────────────────────────────────────────────────

/**
 * Extract the actionable prompt text from an already-trimmed line, or `null` to skip it.
 * Prose lines, done checkboxes, and in-flight checkboxes all return `null`.
 * Callers must test BARRIER before calling this (barriers are not handled here).
 */
function promptText(trimmed: string): string | null {
	if (PROSE.test(trimmed)) return null;
	const cbMatch = CHECKBOX.exec(trimmed);
	if (cbMatch !== null) {
		const [, stateChar = "", text = ""] = cbMatch;
		if (STATE_MAP[stateChar] !== undefined) return null; // done or inflight → skip
		return text.length === 0 ? null : text;
	}
	const bulletMatch = BULLET.exec(trimmed);
	if (bulletMatch !== null) {
		const [, text = ""] = bulletMatch;
		return text.length === 0 ? null : text;
	}
	return trimmed;
}

/**
 * Extract the displayable text from an already-trimmed line for use as a prompt payload.
 * Prefers CHECKBOX g2, then BULLET g1, then the trimmed line itself.
 */
function extractText(trimmed: string): string {
	const cbMatch = CHECKBOX.exec(trimmed);
	if (cbMatch !== null) {
		const [, , text = ""] = cbMatch;
		return text;
	}
	const bulletMatch = BULLET.exec(trimmed);
	if (bulletMatch !== null) {
		const [, text = ""] = bulletMatch;
		return text;
	}
	return trimmed;
}

/** Normalize a single raw line to checkbox format; leave already-classified lines as-is. */
function normalizeLine(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed.length === 0) return raw;
	if (CONTINUATION.test(raw) && !BARRIER.test(trimmed)) return raw; // indented continuation — keep verbatim
	if (BARRIER.test(trimmed)) return raw;
	if (PROSE.test(trimmed)) return raw;
	if (CHECKBOX.test(trimmed)) return raw;
	const bulletMatch = BULLET.exec(trimmed);
	if (bulletMatch !== null) {
		const [, text = ""] = bulletMatch;
		return text.length === 0 ? raw : `- [ ] ${text}`;
	}
	return `- [ ] ${trimmed}`;
}

// ─── public API ─────────────────────────────────────────────────────────────

/**
 * Classify a single line's checkbox state and payload text (operates on the TRIMMED line).
 * Returns `state: null` for non-checkbox lines; `text` strips any leading bullet marker
 * (`- ` / `* `), or is the trimmed line if no marker is present.
 */
export function parseTaskLine(line: string): {
	state: TaskState | null;
	text: string;
} {
	const trimmed = line.trim();
	const cbMatch = CHECKBOX.exec(trimmed);
	if (cbMatch !== null) {
		const [, stateChar = "", text = ""] = cbMatch;
		const state: TaskState = STATE_MAP[stateChar] ?? "pending";
		return { state, text };
	}
	const bulletMatch = BULLET.exec(trimmed);
	if (bulletMatch !== null) {
		const [, text = ""] = bulletMatch;
		return { state: null, text };
	}
	return { state: null, text: trimmed };
}

/**
 * Scan lines top-to-bottom (0-based index) and return the head of the queue.
 * Blank, prose, and orphan continuation lines are skipped; done/inflight checkboxes
 * are skipped; the first barrier encountered returns `{ kind:'barrier', line }`.
 * The first pending or plain/bullet line with non-empty text returns
 * `{ kind:'prompt', line, text }`, where `text` joins the head with any immediately
 * following indented continuation lines (left-trimmed, newline-separated) so an
 * indented block is dispatched as one multi-line prompt. A blank or non-indented
 * line ends the continuation group. Returns `{ kind:'empty' }` when no actionable line exists.
 */
export function findHead(note: string): QueueHead {
	const lines = note.split("\n");
	for (let i = 0; i < lines.length; i++) {
		const head = classifyAt(lines, i);
		if (head !== null) return head;
	}
	return { kind: "empty" };
}

/** Classify the line at `i` as a head, or `null` to skip it (blank/prose/continuation/done). */
function classifyAt(lines: string[], i: number): QueueHead | null {
	const raw = lines[i];
	if (raw === undefined) return null;
	const trimmed = raw.trim();
	if (trimmed.length === 0) return null;
	if (BARRIER.test(trimmed)) return { kind: "barrier", line: i };
	if (CONTINUATION.test(raw)) return null; // continuation without a head above — skip
	const text = promptText(trimmed);
	if (text === null) return null;
	return {
		kind: "prompt",
		line: i,
		text: [text, ...gatherContinuation(lines, i)].join("\n"),
	};
}

/** Left-trimmed indented lines immediately after `head`, stopped by a blank/non-indented/barrier line. */
function gatherContinuation(lines: string[], head: number): string[] {
	const out: string[] = [];
	for (let j = head + 1; j < lines.length; j++) {
		const next = lines[j];
		if (next === undefined || next.trim().length === 0) break;
		if (BARRIER.test(next.trim()) || !CONTINUATION.test(next)) break;
		out.push(next.replace(/^\s+/, ""));
	}
	return out;
}

/**
 * Rewrite the line at `line` to `- [>] <text>`, extracting the prompt text from
 * the existing line (CHECKBOX g2 → BULLET g1 → trimmed fallback). Out-of-range is a no-op.
 */
export function markInflight(note: string, line: number): string {
	const lines = note.split("\n");
	if (line < 0 || line >= lines.length) return note;
	const raw = lines[line];
	if (raw === undefined) return note;
	lines[line] = `- [>] ${extractText(raw.trim())}`;
	return lines.join("\n");
}

/**
 * Mark every in-flight line (`[-*] [>] text`) as done (`- [x] text`).
 * Returns the note string unchanged (by value) if no in-flight lines are present.
 */
export function completeInflight(note: string): string {
	return note
		.split("\n")
		.map((raw): string => {
			const m = INFLIGHT.exec(raw.trim());
			if (m === null) return raw;
			const [, text = ""] = m;
			return `- [x] ${text}`;
		})
		.join("\n");
}

/**
 * Delete the barrier line at `line` entirely, passing the HITL checkpoint.
 * Out-of-range indices are a no-op.
 */
export function removeBarrier(note: string, line: number): string {
	const lines = note.split("\n");
	if (line < 0 || line >= lines.length) return note;
	lines.splice(line, 1);
	return lines.join("\n");
}

/**
 * Normalize every line of the note to checkbox format where applicable.
 * Blank, barrier, prose, and already-checkbox lines are preserved as-is.
 * A bullet with non-empty content becomes `- [ ] <g1>`.
 * Any other non-blank plain line becomes `- [ ] <trimmed>`.
 * Bullets whose content is empty (after trimming) are left unchanged.
 */
export function normalizeQueue(note: string): string {
	return note.split("\n").map(normalizeLine).join("\n");
}

/**
 * Append a new `- [ ] <text>` line at the very bottom of the note.
 * Trims text first; returns the note unchanged if text is empty.
 * Ensures exactly one newline separates the new line from existing content.
 * An empty note becomes `- [ ] <text>` with no leading newline.
 */
export function appendTask(note: string, text: string): string {
	const trimmed = text.trim();
	if (trimmed.length === 0) return note;
	const newLine = `- [ ] ${trimmed}`;
	if (note.length === 0) return newLine;
	return (note.endsWith("\n") ? note : `${note}\n`) + newLine;
}

/** One planned step of a generated queue: a prompt, optional indented detail lines, and an optional trailing HITL barrier. */
export interface QueueStep {
	/** The prompt text (becomes a `- [ ] <prompt>` line). */
	prompt: string;
	/** Continuation lines sent together with the prompt (rendered two-space indented). */
	details?: string[];
	/** When true, a `---` human-in-the-loop barrier is rendered after this step. */
	barrierAfter?: boolean;
}

/** Render a single step to note lines (prompt, two-space-indented details, optional `---`); empty prompt → no lines. */
function renderStep(step: QueueStep): string[] {
	const prompt = step.prompt.trim();
	if (prompt.length === 0) return [];
	const lines = [`- [ ] ${prompt}`];
	for (const detail of step.details ?? []) {
		const d = detail.trim();
		if (d.length > 0) lines.push(`  ${d}`);
	}
	if (step.barrierAfter) lines.push("---");
	return lines;
}

/**
 * Render structured {@link QueueStep}s and append them at the bottom of the note.
 * Each step becomes a `- [ ] <prompt>` line, each detail a two-space-indented
 * continuation, and `barrierAfter` adds a `---` barrier line. Empty-prompt steps
 * are skipped; the note is returned unchanged when nothing renders. Ensures
 * exactly one newline separates the new block from existing content.
 */
export function appendQueue(note: string, steps: QueueStep[]): string {
	const block = steps.flatMap(renderStep).join("\n");
	if (block.length === 0) return note;
	if (note.length === 0) return block;
	return (note.endsWith("\n") ? note : `${note}\n`) + block;
}
