# @aryrabelo/omp-free-text

[![CI](https://github.com/aryrabelo/omp-free-text/actions/workflows/ci.yml/badge.svg)](https://github.com/aryrabelo/omp-free-text/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Runtime: Bun](https://img.shields.io/badge/runtime-Bun-000000.svg?logo=bun)](https://bun.sh)

An OMP (Oh My Pi) extension that gives you a free-text session-notes panel below the status line, persisted per repo, branch, and session — and doubles the note as a FIFO prompt queue you can drip-feed to the agent.

If this is useful to you, please ⭐ the repo — it helps others find it.

## Contents

- [What it does](#what-it-does)
- [Install in another OMP](#install-in-another-omp)
- [Usage](#usage)
  - [Browse other sessions](#browse-other-sessions)
  - [Prompt queue](#prompt-queue)
  - [Copy the note](#copy-the-note)
  - [Let the agent add tasks](#let-the-agent-add-tasks)
  - [Generate a queue from a goal](#generate-a-queue-from-a-goal)
  - [Configurable shortcuts](#configurable-shortcuts)
- [Storage](#storage)
- [Development](#development)
- [Non-goals / Roadmap](#non-goals--roadmap)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## What it does

- Shows a notes panel directly below the status line. It is a read-only preview: the note body followed by a dimmed hint that reads `(Ctrl+N · Ctrl+↓ queue · Ctrl+Shift+↓ auto)` by default (a trailing `▶` marks the toggle key while auto-run is on). The hint reflects your configured keys.
- Lets you edit notes with the `Ctrl+N` keyboard shortcut or the `/note` slash command, which opens a multi-line editor (Enter saves, Shift+Enter newline, Esc closes with a save/discard confirm). `/note <text>` appends `<text>` straight to the queue without opening the editor.
- Lets you browse notes from your other sessions with `/notes`.
- Doubles the note as a prompt queue of markdown checkbox tasks: `Ctrl+↓` dispatches the head task and the panel shows its state as a glyph — `☐` pending, `▸` in-flight, `✓` done — while `Ctrl+Shift+↓` toggles auto-run (default keys — rebindable, see [Configurable shortcuts](#configurable-shortcuts)).
- Copies the whole note to your system clipboard with `Alt+Shift+C` (OSC 52, works locally and over SSH).
- Lets the agent add tasks to your note itself via the `note_add` tool — say "coloca na nota ..." and it appends a `- [ ]` line.
- Turns a goal into a whole prompt queue with `/make-note <goal>` — the agent decomposes it into sequential prompts (with `---` review barriers) and writes them via the `make_note` tool.
- Saves notes to `~/.omp-free-text/{repo}/{branch}/{session-id}.md`, where `repo` is the git repository directory name, `branch` is the current git branch, and `session-id` is the OMP session id. Outside a git repo it falls back to the current directory name and `no-branch`.
- Saves notes when you close the editor and flushes them when the session shuts down.

## Install in another OMP

The repo is public, so installing needs no GitHub authentication.

```sh
omp plugin install github:aryrabelo/omp-free-text
```

Pin a branch, tag, or commit with `#ref`, e.g. `github:aryrabelo/omp-free-text#main`.

### Local development

```sh
git clone https://github.com/aryrabelo/omp-free-text.git
omp plugin link ./omp-free-text
```

`link` symlinks the local checkout into `~/.omp/plugins`, so edits to the source are picked up on the next OMP start.

### Verify, update, remove

```sh
omp plugin list                                    # confirm it loaded and is enabled
omp plugin install github:aryrabelo/omp-free-text  # re-run to update
omp plugin uninstall @aryrabelo/omp-free-text      # remove
```

After installing, start OMP in any repo: the notes panel renders below the status line, and `Ctrl+N` / `/note` open the editor.

## Usage

Press `Ctrl+N` or type `/note` to open the editor. Type freely, then close or submit the editor to save. The panel below the status line shows the latest note.

### Browse other sessions

Type `/notes` to open a keyboard picker listing notes from your **other** sessions in the same repo and branch. Choose one to open it in a read-only viewer — handy for pulling context from a parallel or earlier session without leaving the current one.

### Prompt queue

The note doubles as a FIFO prompt queue of markdown checkbox tasks. You type plain lines (or `-` bullets); on save they auto-normalize to `- [ ]` tasks, so you never type `[ ]` by hand. `#` headings and `>` quotes stay prose and are never dispatched.

- `Ctrl+↓` sends the head pending task to the agent and marks it `- [>]` (in-flight); when the turn settles it becomes `- [x]` (done). The panel renders these states as glyphs — `☐` pending, `▸` in-flight, `✓` done.
- A lone `---` line (3 or more dashes) is a human-in-the-loop barrier. `Ctrl+↓` on a barrier deletes that line instead of sending it, passing the checkpoint so the next `Ctrl+↓` resumes with the line below.
- `Ctrl+Shift+↓` toggles auto-run, which feeds one queued line per agent settle (it primes the first line immediately if the agent is already idle). While auto-run is on the panel hint marks the toggle key with a trailing `▶`, e.g. `(Ctrl+N · Ctrl+↓ queue · Ctrl+Shift+↓ auto ▶)`.
- Auto-run pauses at a `---` barrier (and, inside Herdr with `HERDR_ENV=1`, fires a `herdr notification show` ping with `--sound request` so the workspace alerts you). It also halts if a turn ends in error or is aborted.

**Known limit:** OMP caps continuation chains at 8 (`SESSION_STOP_CONTINUATION_CAP`), so a barrier-free run drains at most ~8 lines per chain before pausing. Use `---` barriers to checkpoint longer queues.

### Copy the note

Press `Alt+Shift+C` to copy the whole note buffer to your system clipboard. It uses an OSC 52 escape, so it works both locally and over SSH. There is no text-selection model and `Ctrl+C` is reserved by OMP, so copy is whole-buffer and keyboard-only.

### Let the agent add tasks

The agent can append tasks to your note itself through the `note_add` tool: say something like "coloca na nota ..." (or "add to the list", "remember to ...") and it appends a `- [ ]` line to the bottom of the current note. The tool is auto-available in every session once the extension is installed — no separate skill install.

### Generate a queue from a goal

Type `/make-note <goal>` to turn a high-level goal into a ready-to-drain prompt queue in one shot. The agent decomposes the goal into sequential prompts and writes them to the note via the `make_note` tool: one `- [ ]` task per step, indented detail lines sent together with their prompt, and a `---` human-in-the-loop barrier wherever it decides you should review before the queue continues. Then drive it with `Ctrl+↓` / auto-run like any other queue. (`/note <text>` is the manual one-liner version — it appends a single `- [ ]` task without the agent.)

### Configurable shortcuts

All three shortcuts are read once at startup from a global `~/.omp-free-text/config.json` (not per repo/branch):

```json
{
  "shortcuts": {
    "editNotes": "ctrl+n",
    "queueStep": "ctrl+down",
    "queueToggleAuto": "ctrl+shift+down"
  }
}
```

Omit the file (or any key) to keep the defaults shown above. A missing or malformed entry falls back to its default and logs a warning. This is the escape hatch when your terminal does not emit a distinct `Ctrl+Shift+↓`: rebind `queueToggleAuto` to a combo it does send (e.g. `"ctrl+b"`). Use OMP `KeyId` syntax — lowercase `modifier+key`, modifiers `ctrl`/`shift`/`alt`/`super` (e.g. `"alt+enter"`).

## Storage

Each session gets its own markdown file under `~/.omp-free-text/`, organized by repo and branch. The files are plain markdown, so you can read or edit them directly. Every changed save (including discarded drafts) is also appended to a sibling `{session-id}.history.md` file, giving you an append-only history of the note.

## Development

This is a TypeScript/Bun extension. The entry point is `src/main.ts`.

- Run unit tests with `bun test`.
- Typecheck with `bun run typecheck`.
- Lint and format with `bun run lint` (check) / `bun run format` (apply). Style is enforced by [Biome](https://biomejs.dev).

## Non-goals / Roadmap

These are deliberately out of scope today, listed as boundaries rather than promises:

- **Inline editable panel** via `setEditorComponent` (replacing the popup overlay) — edit in place below the status line instead of in a separate editor.
- **Per-session history-version browsing** of the `.history.md` timeline — step through the append-only versions of a note.
- **Clickable widget** — needs OMP SDK `onClick` support before the panel can react to mouse interaction.
- **Optional Herdr companion pane** sharing the note file — surface the same note inside a Herdr workspace pane.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, gates, and commit conventions.

## Security

See [SECURITY.md](SECURITY.md) for the security policy and how to report vulnerabilities.

## License

MIT, Ary Rabelo.
