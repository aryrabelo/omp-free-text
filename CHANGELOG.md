# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Configurable keyboard shortcuts via a global `~/.omp-free-text/config.json` (`{ "shortcuts": { "editNotes", "queueStep", "queueToggleAuto" } }`). Defaults are unchanged (`ctrl+n` / `ctrl+down` / `ctrl+shift+down`); a missing or malformed entry falls back to its default and logs a warning. Rebind `queueToggleAuto` when your terminal does not emit a distinct `Ctrl+Shift+↓`. The widget hint now lists all three configured keys — e.g. `(Ctrl+N · Ctrl+↓ queue · Ctrl+Shift+↓ auto)` — so the auto-run toggle is discoverable in the terminal.
- Checkbox task queue: note lines carry a markdown checkbox state — `- [ ]` pending, `- [>]` in-flight, `- [x]` done — rendered in the panel as north-style glyphs `☐`/`▸`/`✓`. Plain lines and `-` bullets auto-normalize to `- [ ]` on save, so you never type `[ ]` by hand; `#` headings and `>` quotes stay prose.
- `Alt+Shift+C` copies the whole note buffer to the system clipboard via an OSC 52 escape (works locally and over SSH).
- `note_add` LLM tool: the agent can append a `- [ ]` task to the bottom of the current note when you say things like "coloca na nota/lista", "add to the list", or "remember to ...". Auto-available in every session once installed — no separate skill install.
- Indented continuation lines: lines indented under a prompt are sent together as one multi-line prompt (left-trimmed, newline-joined); a blank, non-indented, or `---` line ends the block. They stay verbatim in the note (never normalized into checkboxes) and render in the panel with a dim `┆` connector under the task head, so the block reads as one task.

### Changed

- Prompt queue replaced the strikethrough (`~~...~~`) record model with the checkbox state machine: dispatch marks the head `- [>]`, each agent settle completes the in-flight line to `- [x]`, and auto-run feeds the next pending task; a `---` barrier or a failed/aborted turn halts auto-run.

### Fixed

- Auto-run now feeds each queued line as a real follow-up user message, so dispatched prompts appear in the transcript exactly as if you typed them (previously auto-fed lines were injected as an invisible `session_stop` continuation and only the replies showed). Manual `Ctrl+↓` steps were already visible. This also removes the ~8-line `SESSION_STOP_CONTINUATION_CAP` ceiling: a long queue now drains one visible turn at a time until a `---` barrier or a failed/aborted turn halts it.
- The human-in-the-loop pause now shows how to resume: the widget hint appends an explicit unlock instruction naming the queue-step key (e.g. `⏸ paused — Ctrl+↓ passes ---`) and the pause notification names it too. The blocked state is tracked everywhere, not only inside Herdr.

## [0.1.0] - 2026-06-18

### Added

- Free-text session-notes widget rendered in a bordered panel below the status line.
- `Ctrl+N` / `/note` notes editor in the input slot (Enter saves, Shift+Enter newline, Esc closes with a save/discard confirm).
- `/notes` cross-session browser: keyboard picker of notes from other sessions in the same repo/branch, opened in a read-only viewer.
- Append-only `.history.md` sibling file recording every changed save (including discarded drafts).
- Prompt queue: `Ctrl+↓` sends the first not-yet-struck note line to the agent and strikes it (`~~text~~`); a lone `---` line acts as a human-in-the-loop barrier; `Ctrl+Shift+↓` toggles auto-run, which feeds one queued line per agent settle and, inside Herdr (`HERDR_ENV=1`), pings the human with `herdr notification show ... --sound request` at each barrier.

### Notes

- Auto-run drains at most ~8 lines per continuation chain (OMP's `SESSION_STOP_CONTINUATION_CAP`), then pauses. Use `---` barriers to checkpoint longer queues.
