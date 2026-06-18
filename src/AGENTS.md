# AGENTS.md — src (DOX child)

## Purpose

The OMP extension implementation: a free-text session-notes panel and its persistence. Parent rules live in the root `AGENTS.md`; this doc owns the source-level contracts.

## Ownership

- `main.ts` — the extension factory (default export). Owns ALL `@oh-my-pi/pi-coding-agent` API usage: `session_start` / `session_switch` / `session_shutdown` handlers, the `Ctrl+N` shortcut, the `/note` command, the `belowEditor` widget, the notes editor overlay (`ctx.ui.custom` hosting a `CustomEditor`), the unsaved-changes `ctx.ui.confirm` prompt, and history append on save/discard. `makeNotesEditor` (module scope) builds the `CustomEditor` from the injected `pi.pi` SDK (see Work Guidance); `applyEditorResult` resolves the close (save / discard / ask) and persists; location resolution via `pi.exec("git", ...)` + `ctx.sessionManager.getSessionId()`.
- `paths.ts` — pure path derivation: `sanitizeSegment`, `resolveLocation`, `notePathFor`, `historyPathFor`, `ROOT_DIR_NAME`. No fs, git, or TUI.
- `store.ts` — persistence: `loadNote`, `saveNote`, the append-only `appendHistory` (optional `label` suffix, e.g. `discarded`), and the coalescing writer `createDebouncedSaver` returning the named `DebouncedSaver`. Only `node:fs/promises`.
- `widget.ts` — pure rendering: `renderWidgetLines`, `WidgetStyle`/`PLAIN_STYLE`, `SHORTCUT_HINT`, `EMPTY_HINT`. Styling (incl. the `topBorder` line) is injected via `WidgetStyle` (no theme import); `main.ts` builds the real styler from `ctx.ui.theme`.
- `editor.ts` — pure close-decision logic: `resolveCloseAction` and the `CloseAction` type. Given (original, latest buffer, submitted?) it returns `save` / `discard` / `ask`. No OMP, TUI, or fs.

## Local Contracts

- The pure modules (`paths`, `store`, `widget`, `editor`) MUST NOT import OMP, TUI, or git. `main.ts` is the only OMP-coupled module; keep new OMP-dependent logic there.
- Path scheme: `~/.omp-free-text/{repo}/{branch}/{session-id}.md`. Segments are sanitized (path separators and unsafe chars collapse to dashes; leading dots/dashes stripped) so notes cannot escape the root or create hidden files. Fallbacks: repo → `basename(cwd)`, branch → `no-branch`, detached HEAD → `detached`.
- Widget content is a `string[]` capped at 10 lines (OMP limit): an optional `topBorder` line, then the trailing lines of the note, then a `SHORTCUT_HINT` line. Body lines run through the injected `WidgetStyle` and get the styled gutter glyph prefixed; the border and shortcut lines are ungutered. The default `PLAIN_STYLE` is identity (no border, unprefixed) for tests and non-UI paths.
- Editor close: `main.ts` opens a `CustomEditor` overlay. Enter saves; Shift+Enter inserts a newline; Esc returns the buffer. `resolveCloseAction` decides — submit always saves, an unchanged Esc discards silently, and an Esc with unsaved changes calls `ctx.ui.confirm` (save or discard) so work is never silently dropped. A save schedules a debounced write and, when the content changed, appends a snapshot via `appendHistory`. `flush()` runs on `session_shutdown` and before re-init on `session_switch`.
- History: each changed save appends `## <ISO timestamp>` + the note body to `~/.omp-free-text/{repo}/{branch}/{session-id}.history.md` (append-only, sibling to the note). A discarded Esc draft is also appended, labelled `(discarded)`, so nothing typed is ever truly lost — the file is a chronological record of every version, saved or thrown away.
- Export named types; never publish a contract through `ReturnType<typeof fn>` (timer handles excepted).

## Work Guidance

- Add or change an OMP API call only after confirming its signature in the installed `@oh-my-pi/pi-coding-agent` type definitions.
- Runtime values that touch OMP singletons (the active theme, `CustomEditor`, `getEditorTheme`) MUST be taken from the injected `pi.pi` namespace, NEVER from a static `import { … } from "@oh-my-pi/pi-coding-agent"`. omp runs the bundled `dist/cli.js`; a static value import resolves to a second `src/` copy of the package whose theme singleton is never initialised, so `getEditorTheme()` throws `theme.getSymbolPreset` on open. Static imports are fine for types only (`import type`).
- Prefer adding logic to the relevant pure module with a unit test over growing `main.ts`.

## Verification

- `bun test` covers `paths`, `store`, `widget`, and `editor`. New pure logic MUST ship with a test in `tests/`.
- `bun run typecheck` must pass; it validates `main.ts` against the real OMP types.

## Child DOX Index

- None (leaf).
