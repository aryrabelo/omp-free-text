# Contributing

Thanks for your interest in improving `@aryrabelo/omp-free-text`.

## Prerequisites

- [Bun](https://bun.sh) (>= 1.0.0).

## Setup

```sh
bun install
```

## Verify

Run both checks before opening a pull request:

```sh
bun run typecheck && bun test
```

## Conventions

- TypeScript runs in strict mode — keep it type-clean (`bun run typecheck` must pass).
- Keep the pure modules (`src/queue.ts`, `src/store.ts`, `src/paths.ts`, `src/editor.ts`, `src/widget.ts`) free of OMP host imports; OMP wiring lives in `src/main.ts`.
- New pure logic ships with a test in `tests/`.
- Use [Conventional Commits](https://www.conventionalcommits.org/) in English.

## Dev install

Clone the repo and link it into your OMP harness:

```sh
omp plugin link
```
