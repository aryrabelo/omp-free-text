# DOX framework — omp-plugin-free-text

- DOX is a high-performance AGENTS.md hierarchy installed here.
- Every agent must follow DOX instructions across any edits.

## Project

`@aryrabelo/omp-free-text` is a public OMP (Oh My Pi) harness extension written in TypeScript and run by Bun. It renders a free-text session-notes panel directly below the status line and lets the user edit notes via the `Ctrl+N` shortcut or the `/note` command. Notes persist to `~/.omp-free-text/{repo}/{branch}/{session-id}.md`.

- Entry point: `src/main.ts` (declared in `package.json` under `omp.extensions`).
- Install for distribution: `omp plugin install git:github.com/aryrabelo/omp-free-text`.

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees.
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it.

## Read Before Editing

1. Read the root AGENTS.md.
2. Identify every file or folder you expect to touch.
3. Walk from the repository root to each target path.
4. Read every AGENTS.md found along each route.
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there.
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules.
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX.

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Update child docs when parent changes alter local rules. Remove stale or contradictory text immediately. Small edits that do not change behavior or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- This root AGENTS.md is the DOX rail: project-wide instructions, global preferences, durable workflow rules, and the top-level Child DOX Index.
- Child AGENTS.md files own domain-specific instructions and their own Child DOX Index.
- Each parent explains what its direct children cover and what stays owned by the parent.
- The closer a doc is to the work, the more specific and practical it must be.

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own purpose, rules, responsibilities, workflow, materials, or quality standards.
- Work Guidance must reflect current standards or user instructions; if none exist yet, leave it empty.
- Verification must reflect an existing check; if no framework exists yet, leave it empty and update it when one exists.

Default section order: Purpose, Ownership, Local Contracts, Work Guidance, Verification, Child DOX Index.

## Style

- Keep docs concise, current, and operational.
- Document stable contracts, not diary entries.
- Put broad rules in parent docs and concrete details in child docs.
- Prefer direct bullets with explicit names.
- Do not duplicate rules across files unless each scope needs a local version.
- Delete stale notes instead of explaining history.

## Work Guidance

- Runtime is Bun; language is TypeScript (`strict`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`).
- Keep pure logic (`src/paths.ts`, `src/store.ts`, `src/widget.ts`) free of OMP, TUI, and git imports so it stays unit-testable. Only `src/main.ts` may import `@oh-my-pi/pi-coding-agent`.
- Ground every OMP API call against the installed `@oh-my-pi/pi-coding-agent` type definitions. Never invent API.
- Gate-enforced conventions: name exported types instead of leaking `ReturnType<typeof fn>` (timer handles excepted); no redundant `clearTimeout`/`clearInterval` truthiness guards; explicit types on exported and handler parameters (biome `useExplicitType`); no `async` without `await`.
- Git commit messages and PR titles/descriptions are English, Conventional Commits. No CJK in any generated artifact.

## Verification

- `bun test` — unit tests for `src/paths.ts`, `src/store.ts`, `src/widget.ts`.
- `bun run typecheck` (`tsc --noEmit`) — typechecks `src/` and `tests/` against the real OMP types.
- Manual smoke: load in `omp`, confirm the panel renders below the status line and that `Ctrl+N` / `/note` open the editor and write the session `.md`.

## Closeout

1. Re-check changed paths against the DOX chain.
2. Update nearest owning docs and any affected parents or children.
3. Refresh every affected Child DOX Index.
4. Remove stale or contradictory text.
5. Run existing verification when relevant.
6. Report any docs intentionally left unchanged and why.

## User Preferences

- Slice 1 interaction is a read-only widget below the status line (`setWidget`, placement `aboveEditor`) plus a `Ctrl+N` shortcut and a `/note` command that open `ctx.ui.editor`. Click-to-open is intentionally out of scope: OMP does not enable mouse reporting or hit-testing, and `setWidget` is render-only.
- Persistence path is fixed: `~/.omp-free-text/{repo}/{branch}/{session-id}.md`. Outside a git repo, fall back to `basename(cwd)` and `no-branch`.
- Notes save when the editor closes and flush on `session_shutdown`.
- Evolution (not yet built): an inline editable panel via `setEditorComponent` (keyboard focus, still no mouse click), and an optional Herdr companion pane sharing the same file path.

## Child DOX Index

- `src/AGENTS.md` — extension source: per-module ownership (pure logic vs OMP API wiring), local contracts, and authoring rules.
