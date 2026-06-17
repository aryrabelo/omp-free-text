# AGENTS.md — src (DOX child)

## Purpose

The OMP extension implementation: a free-text session-notes panel and its persistence. Parent rules live in the root `AGENTS.md`; this doc owns the source-level contracts.

## Ownership

- `main.ts` — the extension factory (default export). Owns ALL `@oh-my-pi/pi-coding-agent` API usage: `session_start` / `session_switch` / `session_shutdown` handlers, the `Ctrl+N` shortcut, the `/note` command, the `aboveEditor` widget, and location resolution via `pi.exec("git", ...)` + `ctx.sessionManager.getSessionId()`.
- `paths.ts` — pure path derivation: `sanitizeSegment`, `resolveLocation`, `notePathFor`, `ROOT_DIR_NAME`. No fs, git, or TUI.
- `store.ts` — persistence: `loadNote`, `saveNote`, and the coalescing writer `createDebouncedSaver` returning the named `DebouncedSaver`. Only `node:fs/promises`.
- `widget.ts` — pure rendering: `renderWidgetLines`, `DEFAULT_TITLE`, `EMPTY_HINT`.

## Local Contracts

- The pure modules (`paths`, `store`, `widget`) MUST NOT import OMP, TUI, or git. `main.ts` is the only OMP-coupled module; keep new OMP-dependent logic there.
- Path scheme: `~/.omp-free-text/{repo}/{branch}/{session-id}.md`. Segments are sanitized (path separators and unsafe chars collapse to dashes; leading dots/dashes stripped) so notes cannot escape the root or create hidden files. Fallbacks: repo → `basename(cwd)`, branch → `no-branch`, detached HEAD → `detached`.
- Widget content is a `string[]` capped at 10 lines (OMP limit): a title line followed by the trailing lines of the note.
- Saving: `main.ts` schedules a debounced write when the editor closes and calls `flush()` on `session_shutdown` and before re-initializing on `session_switch`.
- Export named types; never publish a contract through `ReturnType<typeof fn>` (timer handles excepted).

## Work Guidance

- Add or change an OMP API call only after confirming its signature in the installed `@oh-my-pi/pi-coding-agent` type definitions.
- Prefer adding logic to the relevant pure module with a unit test over growing `main.ts`.

## Verification

- `bun test` covers `paths`, `store`, and `widget`. New pure logic MUST ship with a test in `tests/`.
- `bun run typecheck` must pass; it validates `main.ts` against the real OMP types.

## Child DOX Index

- None (leaf).
