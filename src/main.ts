/**
 * @aryrabelo/omp-free-text
 *
 * OMP extension: a free-text session-notes panel below the status line.
 * - Shows the latest note in a widget below the editor via
 *   `ctx.ui.setWidget(..., { placement: "belowEditor" })`.
 * - Opens a multi-line editor on `Ctrl+N` or `/note`.
 * - Persists to `~/.omp-free-text/{repo}/{branch}/{session-id}.md`.
 */
import type {
  CustomEditor,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  KeybindingsManager,
  Theme,
} from "@oh-my-pi/pi-coding-agent";
import type { TUI } from "@oh-my-pi/pi-tui";
import { homedir } from "node:os";
import { resolveCloseAction } from "./editor";
import { historyPathFor, notePathFor, resolveLocation } from "./paths";
import { appendHistory, createDebouncedSaver, type DebouncedSaver, loadNote, saveNote } from "./store";
import { renderWidgetLines, type WidgetStyle } from "./widget";

const WIDGET_KEY = "free-text";

/** Outcome of the notes editor overlay: the buffer and how it was closed. */
interface EditorResult {
  text: string;
  submitted: boolean;
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
  return editor;
}

export default function freeTextExtension(pi: ExtensionAPI): void {
  let notePath: string | undefined;
  let content = "";
  let saver: DebouncedSaver | undefined;
  let historyPath: string | undefined;

  pi.setLabel("Free Text Notes");

  async function runGit(cwd: string, args: string[]): Promise<string | null> {
    try {
      const res = await pi.exec("git", args, { cwd });
      return res.code === 0 ? res.stdout.trim() : null;
    } catch {
      return null;
    }
  }

  function widgetStyle(ctx: ExtensionContext): WidgetStyle {
    const theme = ctx.ui.theme;
    const box = theme.boxRound;
    return {
      topBorder: theme.fg("borderAccent", box.topLeft + box.horizontal.repeat(2)),
      hint: (t: string): string => theme.fg("dim", t),
      body: (t: string): string => theme.fg("text", t),
      shortcut: (t: string): string => theme.fg("dim", t),
      gutter: theme.fg("borderAccent", box.vertical),
    };
  }

  function refreshWidget(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    ctx.ui.setWidget(WIDGET_KEY, renderWidgetLines(content, { style: widgetStyle(ctx) }), {
      placement: "belowEditor",
    });
  }

  async function initSession(ctx: ExtensionContext): Promise<void> {
    saver?.dispose();
    const [repoToplevel, branch] = await Promise.all([
      runGit(ctx.cwd, ["rev-parse", "--show-toplevel"]),
      runGit(ctx.cwd, ["rev-parse", "--abbrev-ref", "HEAD"]),
    ]);
    const loc = resolveLocation({
      cwd: ctx.cwd,
      repoToplevel,
      branch,
      sessionId: ctx.sessionManager.getSessionId(),
    });
    notePath = notePathFor(loc, homedir());
    historyPath = historyPathFor(loc, homedir());
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

  async function applyEditorResult(ctx: ExtensionContext, original: string, result: EditorResult): Promise<void> {
    const action = resolveCloseAction(original, result.text, result.submitted);
    if (action === "discard") return;
    if (action === "ask" && !(await ctx.ui.confirm("Unsaved notes", "Save your changes?"))) {
      // Keep the discarded draft in history so typed work is never truly lost.
      if (historyPath !== undefined) await appendHistory(historyPath, result.text, new Date(), "discarded");
      ctx.ui.notify("Notes discarded (kept in history)", "info");
      return;
    }
    await persist(ctx, result.text);
    ctx.ui.notify("Notes saved", "info");
  }

  async function openEditor(ctx: ExtensionContext): Promise<void> {
    if (!ctx.hasUI || notePath === undefined) return;
    const original = content;
    const result = await ctx.ui.custom<EditorResult>(
      (tui: TUI, _theme: Theme, _keybindings: KeybindingsManager, done: (r: EditorResult) => void): CustomEditor =>
        makeNotesEditor(pi.pi, tui, original, done),
      { overlay: true },
    );
    await applyEditorResult(ctx, original, result);
  }

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

  pi.registerShortcut("ctrl+n", {
    description: "Edit free-text session notes",
    handler: (ctx: ExtensionContext): Promise<void> => openEditor(ctx),
  });

  pi.registerCommand("note", {
    description: "Edit free-text session notes (~/.omp-free-text/{repo}/{branch}/{session}.md)",
    handler: (_args: string, ctx: ExtensionCommandContext): Promise<void> => openEditor(ctx),
  });
}
