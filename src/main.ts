/**
 * @aryrabelo/omp-free-text
 *
 * OMP extension: a free-text session-notes panel below the status line.
 * - Shows the latest note in a widget below the editor via
 *   `ctx.ui.setWidget(..., { placement: "belowEditor" })`.
 * - Opens a multi-line editor on `Ctrl+N` or `/note`.
 * - Persists to `~/.omp-free-text/{repo}/{branch}/{session-id}.md`.
 */
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import { homedir } from "node:os";
import { notePathFor, resolveLocation } from "./paths";
import { createDebouncedSaver, type DebouncedSaver, loadNote, saveNote } from "./store";
import { renderWidgetLines, type WidgetStyle } from "./widget";

const WIDGET_KEY = "free-text";

export default function freeTextExtension(pi: ExtensionAPI): void {
  let notePath: string | undefined;
  let content = "";
  let saver: DebouncedSaver | undefined;

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
    content = await loadNote(notePath);
    const path = notePath;
    saver = createDebouncedSaver((c) => saveNote(path, c));
    refreshWidget(ctx);
  }

  async function openEditor(ctx: ExtensionContext): Promise<void> {
    if (!ctx.hasUI || notePath === undefined) return;
    // promptStyle: Enter saves + closes, Shift+Enter inserts a newline.
    const result = await ctx.ui.editor("Session notes", content, undefined, { promptStyle: true });
    if (result === undefined) return;
    content = result;
    saver?.schedule(content);
    refreshWidget(ctx);
    ctx.ui.notify("Notes saved", "info");
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
