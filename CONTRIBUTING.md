# Contributing

Thanks for your interest in improving `@aryrabelo/omp-free-text`.

## Prerequisites

- [Bun](https://bun.sh) (>= 1.0.0).

## Setup

```sh
bun install
```

## Verify

Run the full gate before opening a pull request:

```sh
bun run lint && bun run typecheck && bun test
```

`bun run format` applies the Biome formatter/auto-fixes; CI runs `bun run lint`, `bun run typecheck`, and `bun test` on every push and pull request.

## Conventions

- TypeScript runs in strict mode — keep it type-clean (`bun run typecheck` must pass).
- Keep the pure modules (`src/queue.ts`, `src/store.ts`, `src/paths.ts`, `src/editor.ts`, `src/widget.ts`) free of OMP host imports; OMP wiring lives in `src/main.ts`.
- New pure logic ships with a test in `tests/`.
- Style is enforced by [Biome](https://biomejs.dev) (`biome.json`) — run `bun run format` before committing.
- Use [Conventional Commits](https://www.conventionalcommits.org/) in English.

## Dev install

Clone the repo and link it into your OMP harness:

```sh
omp plugin link
```

## Code of Conduct

Be respectful and constructive. Assume good faith, keep discussion focused on the
work, and welcome newcomers. Harassment or personal attacks are not tolerated. To
report a concern, email the maintainer at **aryrabelo@gmail.com**.
