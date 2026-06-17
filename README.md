# @aryrabelo/omp-free-text

An OMP (Oh My Pi) extension that gives you a free-text session-notes panel below the status line, persisted per repo, branch, and session.

## What it does

- Shows a notes panel directly below the status line. The panel is a read-only preview: a title line plus the last lines of the note.
- Lets you edit notes with the `Ctrl+N` keyboard shortcut or the `/note` slash command, which opens a multi-line editor.
- Saves notes to `~/.omp-free-text/{repo}/{branch}/{session-id}.md`, where `repo` is the git repository directory name, `branch` is the current git branch, and `session-id` is the OMP session id. Outside a git repo it falls back to the current directory name and `no-branch`.
- Saves notes when you close the editor and flushes them when the session shuts down.

## Install

```sh
omp plugin install git:github.com/aryrabelo/omp-free-text
```

## Usage

Press `Ctrl+N` or type `/note` to open the editor. Type freely, then close or submit the editor to save. The panel below the status line shows the latest note.

## Storage

Each session gets its own markdown file under `~/.omp-free-text/`, organized by repo and branch. The files are plain markdown, so you can read or edit them directly.

## Development

This is a TypeScript/Bun extension. The entry point is `src/main.ts`.

- Run unit tests with `bun test`.
- Typecheck with `bun run typecheck`.

## License

MIT, Ary Rabelo.
