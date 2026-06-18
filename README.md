# @aryrabelo/omp-free-text

An OMP (Oh My Pi) extension that gives you a free-text session-notes panel below the status line, persisted per repo, branch, and session.

## What it does

- Shows a notes panel directly below the status line. It is a read-only preview: the note body followed by a dimmed `(Ctrl+N)` hint.
- Lets you edit notes with the `Ctrl+N` keyboard shortcut or the `/note` slash command, which opens a multi-line editor.
- Saves notes to `~/.omp-free-text/{repo}/{branch}/{session-id}.md`, where `repo` is the git repository directory name, `branch` is the current git branch, and `session-id` is the OMP session id. Outside a git repo it falls back to the current directory name and `no-branch`.
- Saves notes when you close the editor and flushes them when the session shuts down.

## Install in another OMP

This is a **private** repository, so any install method needs your machine to be authenticated to GitHub for `aryrabelo/omp-free-text` (an SSH key on your GitHub account, or a credential helper for HTTPS). Under the hood `omp plugin install` runs `bun install <git-spec>`, which clones the repo with your git credentials.

### Option A — install over SSH (recommended for private repos)

```sh
omp plugin install git@github.com:aryrabelo/omp-free-text.git
```

SSH uses the key already registered on your GitHub account, so it works for private repos with no extra token setup.

### Option B — install via GitHub shorthand (needs HTTPS credentials)

```sh
omp plugin install github:aryrabelo/omp-free-text
```

Pin a branch, tag, or commit with `#ref`, e.g. `github:aryrabelo/omp-free-text#main`. This clones over HTTPS, so a git credential helper or a `GITHUB_TOKEN` with repo access must be configured.

### Option C — clone and link (local development)

```sh
git clone git@github.com:aryrabelo/omp-free-text.git
omp plugin link ./omp-free-text
```

`link` symlinks the local checkout into `~/.omp/plugins`, so edits to the source are picked up on the next OMP start.

### Verify, update, remove

```sh
omp plugin list                                    # confirm it loaded and is enabled
omp plugin install git@github.com:aryrabelo/omp-free-text.git   # re-run to update
omp plugin uninstall @aryrabelo/omp-free-text      # remove
```

After installing, start OMP in any repo: the notes panel renders below the status line, and `Ctrl+N` / `/note` open the editor.

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
