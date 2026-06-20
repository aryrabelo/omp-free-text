/**
 * @aryrabelo/omp-free-text
 *
 * OMP extension: a free-text session-notes panel below the status line.
 * - Shows the latest note in a widget below the editor via
 *   `ctx.ui.setWidget(..., { placement: "belowEditor" })`.
 * - Opens a multi-line editor on `Ctrl+N` or `/note`.
 * - Runs the note as a prompt queue: `Ctrl+down` sends the next line, a `---`
 *   line is a human-in-the-loop barrier, and `Ctrl+shift+down` toggles auto-run.
 * - Persists to `~/.omp-free-text/{repo}/{branch}/{session-id}.md`.
 */

import { homedir } from "node:os";
import type {
	AgentToolResult,
	AgentToolUpdateCallback,
	CustomEditor,
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	KeybindingsManager,
	Theme,
} from "@oh-my-pi/pi-coding-agent";
import type { KeyId, TUI } from "@oh-my-pi/pi-tui";
import { parseShortcutConfig, queueHint, type ShortcutConfig } from "./config";
import { resolveCloseAction } from "./editor";
import {
	configPathFor,
	historyPathFor,
	notePathFor,
	type ResolvedLocation,
	resolveLocation,
	sessionsDirFor,
} from "./paths";
import { appendTask, normalizeQueue } from "./queue";
import { createQueue } from "./queue-controller";
import {
	appendHistory,
	createDebouncedSaver,
	type DebouncedSaver,
	listNotes,
	loadConfigText,
	loadNote,
	type NoteSummary,
	saveNote,
} from "./store";
import { renderWidgetLines, type WidgetStyle } from "./widget";

const WIDGET_KEY = "free-text";

/** Outcome of the notes editor overlay: the buffer and how it was closed. */
interface EditorResult {
	text: string;
	submitted: boolean;
}

/** Copy text to the system clipboard via the OSC 52 escape (works locally and over SSH). */
function copyNoteToClipboard(text: string): void {
	if (text.length === 0 || !process.stdout.isTTY) return;
	const seq = `\x1b]52;c;${Buffer.from(text).toString("base64")}\x07`;
	try {
		process.stdout.write(seq);
	} catch {
		// OSC 52 is best-effort; never let a clipboard write break the session.
	}
}

/**
 * Build the prompt-style notes editor for `ctx.ui.custom`: Enter saves,
 * Shift+Enter inserts a newline, and Esc closes returning the current buffer
 * (so `openEditor` can offer to save instead of silently dropping the work).
 *
 * `sdk` is the injected `pi.pi` namespace — the running bundle's exports. We
 * MUST construct `CustomEditor` / read `getEditorTheme()` from it, not from a
 * static import: the static import resolves to a second, uninitialised copy of
 * the package (its theme singleton is undefined), which crashes on open.
 */
function makeNotesEditor(
	sdk: ExtensionAPI["pi"],
	tui: TUI,
	original: string,
	done: (result: EditorResult) => void,
): CustomEditor {
	const editor = new sdk.CustomEditor(sdk.getEditorTheme());
	editor.setText(original);
	editor.focused = true;
	editor.onChange = (): void => tui.requestComponentRender(editor);
	editor.onSubmit = (text: string): void => done({ text, submitted: true });
	editor.onEscape = (): void => done({ text: editor.getText(), submitted: false });
	editor.onCopyPrompt = (): void => copyNoteToClipboard(editor.getText());
	return editor;
}

/**
 * Browse notes from OTHER sessions in the same repo/branch: a keyboard selector
 * (newest first) opens the picked note in a read-only viewer. The viewer reuses
 * the notes editor, but its result is ignored, so browsing never changes the
 * current session's note.
 */
async function browseNotes(
	ctx: ExtensionContext,
	sdk: ExtensionAPI["pi"],
	sessionsDir: string,
	currentNotePath: string | undefined,
): Promise<void> {
	const others = (await listNotes(sessionsDir)).filter((n) => n.path !== currentNotePath && n.preview.length > 0);
	if (others.length === 0) {
		ctx.ui.notify("No notes from other sessions yet", "info");
		return;
	}
	const byLabel = new Map<string, NoteSummary>();
	const options = others.map((n): { label: string; description: string } => {
		const stamp = new Date(n.mtimeMs).toISOString().slice(0, 16).replace("T", " ");
		const label = `${stamp}  ${n.preview}`;
		byLabel.set(label, n);
		return { label, description: n.sessionId };
	});
	const picked = await ctx.ui.select("Notes from other sessions", options);
	const note = picked === undefined ? undefined : byLabel.get(picked);
	if (note === undefined) return;
	const text = await loadNote(note.path);
	await ctx.ui.custom<EditorResult>(
		(tui: TUI, _theme: Theme, _keybindings: KeybindingsManager, done: (r: EditorResult) => void): CustomEditor =>
			makeNotesEditor(sdk, tui, text, done),
	);
}

/** Run a git command in `cwd`, returning trimmed stdout or null on any failure. */
async function runGit(pi: ExtensionAPI, cwd: string, args: string[]): Promise<string | null> {
	try {
		const res = await pi.exec("git", args, { cwd });
		return res.code === 0 ? res.stdout.trim() : null;
	} catch {
		return null;
	}
}

/** Build the themed widget styler (border, gutter, body/hint colors). */
function widgetStyle(theme: Theme): WidgetStyle {
	const box = theme.boxRound;
	return {
		topBorder: theme.fg("borderAccent", box.topLeft + box.horizontal.repeat(2)),
		hint: (t: string): string => theme.fg("dim", t),
		body: (t: string): string => theme.fg("text", t),
		shortcut: (t: string): string => theme.fg("dim", t),
		gutter: theme.fg("borderAccent", box.vertical),
		taskPending: (t: string): string => theme.fg("warning", t),
		taskInflight: (t: string): string => theme.fg("accent", t),
		taskDone: (t: string): string => theme.fg("dim", theme.strikethrough(t)),
	};
}

/**
 * Resolve how the notes editor closed and persist accordingly: submit/Enter saves,
 * an unchanged Esc discards silently, and an Esc with unsaved changes asks — a
 * discarded draft is still appended to history so typed work is never lost.
 */
async function applyEditorResult(
	ctx: ExtensionContext,
	original: string,
	result: EditorResult,
	persist: (ctx: ExtensionContext, next: string) => Promise<void>,
	historyPath: string | undefined,
): Promise<void> {
	const action = resolveCloseAction(original, result.text, result.submitted);
	if (action === "discard") return;
	if (action === "ask" && !(await ctx.ui.confirm("Unsaved notes", "Save your changes?"))) {
		// Keep the discarded draft in history so typed work is never truly lost.
		if (historyPath !== undefined) await appendHistory(historyPath, result.text, new Date(), "discarded");
		ctx.ui.notify("Notes discarded (kept in history)", "info");
		return;
	}
	await persist(ctx, normalizeQueue(result.text));
	ctx.ui.notify("Notes saved", "info");
}

/** Load global shortcut overrides (config is not per repo/branch); log any warnings. */
async function loadShortcuts(pi: ExtensionAPI): Promise<ShortcutConfig> {
	const { shortcuts, warnings } = parseShortcutConfig(await loadConfigText(configPathFor(homedir())));
	for (const w of warnings) pi.logger.warn(`[free-text] ${w}`);
	return shortcuts;
}

/** Register the `note_add` tool so the agent can append a task to the bottom of the active note. */
function registerNoteAddTool(
	pi: ExtensionAPI,
	deps: {
		notePath: () => string | undefined;
		content: () => string;
		persist: (ctx: ExtensionContext, next: string) => Promise<void>;
	},
): void {
	const z = pi.zod;
	pi.registerTool({
		name: "note_add",
		label: "Add to note",
		description:
			'Append a task to the bottom of the current session\'s free-text note (the prompt queue). Use when the user asks to put/add/remember something on the note or list for later (e.g. "coloca na nota", "add to the list", "remember to ..."). Each item becomes a "- [ ]" checkbox.',
		parameters: z.object({
			text: z.string().describe("The task text to append (one line)."),
		}),
		approval: "write",
		async execute(
			_toolCallId: string,
			params: { text: string },
			_signal: AbortSignal | undefined,
			_onUpdate: AgentToolUpdateCallback | undefined,
			ctx: ExtensionContext,
		): Promise<AgentToolResult> {
			if (deps.notePath() === undefined) {
				return { content: [{ type: "text", text: "No active note for this session yet." }] };
			}
			await deps.persist(ctx, appendTask(deps.content(), params.text));
			return { content: [{ type: "text", text: `Added to note: ${params.text.trim()}` }] };
		},
	});
}

export default async function freeTextExtension(pi: ExtensionAPI): Promise<void> {
	let notePath: string | undefined, historyPath: string | undefined, sessionsDir: string | undefined;
	let loc: ResolvedLocation | undefined;
	let saver: DebouncedSaver | undefined;
	let content = "";
	let editorOpen = false;
	const shortcuts = await loadShortcuts(pi);

	pi.setLabel("Free Text Notes");

	function refreshWidget(ctx: ExtensionContext): void {
		if (!ctx.hasUI) return;
		const shortcut = queueHint(shortcuts, queue.isAuto(), queue.isBlocked());
		ctx.ui.setWidget(
			WIDGET_KEY,
			renderWidgetLines(content, {
				style: widgetStyle(ctx.ui.theme),
				shortcut,
			}),
			{
				placement: "belowEditor",
			},
		);
	}

	async function initSession(ctx: ExtensionContext): Promise<void> {
		saver?.dispose();
		queue.reset();
		const [repoToplevel, branch] = await Promise.all([
			runGit(pi, ctx.cwd, ["rev-parse", "--show-toplevel"]),
			runGit(pi, ctx.cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
		]);
		loc = resolveLocation({
			cwd: ctx.cwd,
			repoToplevel,
			branch,
			sessionId: ctx.sessionManager.getSessionId(),
		});
		notePath = notePathFor(loc, homedir());
		historyPath = historyPathFor(loc, homedir());
		sessionsDir = sessionsDirFor(loc, homedir());
		content = await loadNote(notePath);
		const path = notePath;
		saver = createDebouncedSaver((c) => saveNote(path, c));
		refreshWidget(ctx);
	}

	async function persist(ctx: ExtensionContext, next: string): Promise<void> {
		if (notePath === undefined) return;
		const changed = next !== content;
		content = next;
		saver?.schedule(content);
		refreshWidget(ctx);
		if (changed && historyPath !== undefined) await appendHistory(historyPath, content);
	}

	async function openEditor(ctx: ExtensionContext): Promise<void> {
		if (!ctx.hasUI || notePath === undefined) return;
		const original = content;
		// No `overlay` option: this mounts the editor in the main input slot (with
		// focus) instead of a hardcoded bottom-center overlay — a natural place to
		// write — and `showHookCustom` restores the prompt on close. While open,
		// auto-run pauses striking (see `editorOpen`) so a save can't clobber strikes.
		editorOpen = true;
		try {
			const result = await ctx.ui.custom<EditorResult>(
				(tui: TUI, _theme: Theme, _keybindings: KeybindingsManager, done: (r: EditorResult) => void): CustomEditor =>
					makeNotesEditor(pi.pi, tui, original, done),
			);
			await applyEditorResult(ctx, original, result, persist, historyPath);
		} finally {
			editorOpen = false;
		}
	}

	const queue = createQueue({
		pi,
		content: () => content,
		persist,
		refresh: refreshWidget,
		label: () => (loc ? `${loc.repo}/${loc.branch}` : "free-text queue"),
		editorOpen: () => editorOpen,
		shortcuts,
	});

	pi.on("session_start", async (_event, ctx) => {
		await initSession(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		await saver?.flush();
		await initSession(ctx);
	});

	pi.on("session_shutdown", async () => {
		await saver?.flush();
	});

	pi.registerShortcut(shortcuts.editNotes as KeyId, {
		description: "Edit free-text session notes",
		handler: (ctx: ExtensionContext): Promise<void> => openEditor(ctx),
	});

	pi.registerCommand("note", {
		description: "Edit free-text session notes (~/.omp-free-text/{repo}/{branch}/{session}.md)",
		handler: (_args: string, ctx: ExtensionCommandContext): Promise<void> => openEditor(ctx),
	});

	pi.registerCommand("notes", {
		description: "Browse notes from other sessions in this repo/branch",
		handler: (_args: string, ctx: ExtensionCommandContext): Promise<void> =>
			ctx.hasUI && sessionsDir !== undefined ? browseNotes(ctx, pi.pi, sessionsDir, notePath) : Promise.resolve(),
	});

	registerNoteAddTool(pi, { notePath: () => notePath, content: () => content, persist });
}
