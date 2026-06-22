# The Tapa standard

The bar every `aryrabelo` open-source repo should clear before it goes public,
reverse-engineered from [`tapa-rs`](https://github.com/aryrabelo/tapa) — the
reference repo for this standard.

Each item below is a checkbox, a one-line statement of what it must contain, and
an inline note on **omp-free-text's current state** (`have ✓` / `missing ✗`).
Checked boxes are what the project already meets today; unchecked boxes are the
gap to close before launch.

> Notes on scope: a few items Tapa itself does **not** ship as separate files
> (standalone Code of Conduct, `FUNDING.yml`, `dependabot.yml`). Tapa folds
> conduct into CONTRIBUTING and handles dependency hygiene with a CI audit job.
> Those are marked **(optional — beyond the Tapa baseline)**. Other items Tapa
> **does** ship as baseline (weekly build, release workflow, size-budget gate,
> THIRD-PARTY-LICENSES) but that are **N/A here** because this is a
> source-installed extension with no compiled artifact, are marked **(N/A —
> Tapa-baseline, artifact-only)** so the baseline stays honest.

---

## Legal & Licensing

- [x] **LICENSE file** — a real OSI license at the repo root (Tapa: MIT, full
  text, current year, author name). _omp-free-text: have ✓ — MIT, `Copyright (c)
  2026 Ary Rabelo`._
- [x] **`license` field in package.json** — SPDX id matching the LICENSE file.
  _omp-free-text: have ✓ — `"license": "MIT"`._
- [x] **Copyright notice consistency** — same author/year across LICENSE,
  package.json, README. _omp-free-text: have ✓ — "MIT, Ary Rabelo" everywhere._
- [ ] **THIRD-PARTY-LICENSES.md** — aggregated SPDX licenses of every dependency
  redistributed in the shipped artifact, generated from the lockfile (not
  hand-curated). _Tapa ships this as a script-generated baseline file
  (`scripts/gen-third-party-licenses.sh` from `Cargo.lock` + bundled JS).
  omp-free-text: **N/A** — the extension ships only `src/` (see package.json
  `files`) and bundles no third-party code (`@oh-my-pi/pi-coding-agent` is a
  peer/dev dependency, not redistributed); confirmed no bundling step exists.
  Add only if a build step ever bundles runtime deps._

## Documentation

- [x] **README that sells and orients** — what it is and the "why", install,
  usage, verification commands, and a license line. _omp-free-text: have ✓ —
  thorough README covering install/usage/storage/dev._
- [x] **README: explicit "Non-goals / scope" section** — states what the project
  deliberately will not do, so feature requests self-filter (Tapa's
  "Non-goals (v1)"). _omp-free-text: have ✓ — "Non-goals / Roadmap" section lists
  inline editable panel, history-version browsing, clickable widget, and the
  Herdr companion pane._
- [x] **CONTRIBUTING.md** — prerequisites, setup, the exact verification gate a
  PR must pass, conventions, and how to dev-install. _omp-free-text: have ✓ —
  covers Bun setup, `bun run lint && bun run typecheck && bun test`, module discipline,
  Conventional Commits._
- [x] **CHANGELOG.md** — Keep a Changelog format, adheres to SemVer, with an
  `[Unreleased]` section. _omp-free-text: have ✓ — correct format and sections._
- [x] **SECURITY.md** — private vulnerability-reporting channel (GitHub advisory
  + email), what to include, response expectation, and supported versions.
  _omp-free-text: have ✓ — advisory + email, scope, supported versions._

## Community Health (`.github/`)

- [x] **Bug report issue template** — structured form (`bug_report.yml`) with
  what-happened, repro steps, OS, and version fields. _omp-free-text: have ✓._
- [x] **Feature request issue template** — structured form
  (`feature_request.yml`) that asks for the problem, not just the solution, with
  a scope-check tied to Non-goals. _omp-free-text: have ✓._
- [x] **ISSUE_TEMPLATE/config.yml** — `blank_issues_enabled: false` and a
  security contact link routing vulnerabilities to private reporting.
  _omp-free-text: have ✓._
- [x] **pull_request_template.md** — "what changed", related issue, and a
  checklist mirroring the CI gate (lint/test/build/docs/scope).
  _omp-free-text: have ✓._
- [x] **Code of Conduct** — at minimum a "be respectful and constructive"
  section inside CONTRIBUTING (the Tapa baseline); a standalone
  `CODE_OF_CONDUCT.md` is the fuller form. _omp-free-text: have ✓ — inline
  "Code of Conduct" section in CONTRIBUTING._
- [ ] **FUNDING.yml** — sponsorship links shown in the GitHub sidebar.
  _(optional — beyond the Tapa baseline; Tapa ships none.)_ _omp-free-text:
  missing ✗._

## CI & Automation

- [x] **CI workflow on push + PR** — runs the full verification gate
  (lint/typecheck, test, build) on every push and pull request.
  _omp-free-text: have ✓ — `.github/workflows/ci.yml` runs `bun run lint` +
  `bun run typecheck` + `bun test`. (Tapa's reference gate is 4 jobs — frontend
  lint/test/build, a Rust job `cargo fmt`/`clippy`/`test`, the audit job, and a
  macOS artifact-size job; the Rust/size/build jobs are N/A for a TS-only,
  artifact-free extension.)_
- [x] **Least-privilege + concurrency on CI** — `permissions: contents: read`
  and a `concurrency` group that cancels superseded runs; scope triggers to
  `branches: [main]`. _omp-free-text: have ✓ — `permissions: contents: read`,
  a cancel-in-progress `concurrency` group, and push scoped to `main`._
- [x] **Dependency audit job** — an advisory (`continue-on-error`) CI job running
  the ecosystem auditor (Tapa: `npm audit` + `cargo audit`). _omp-free-text:
  have ✓ — a `continue-on-error` `audit` job runs `bun audit`._
- [ ] **Local pre-push hooks mirroring CI** — a `lefthook.yml` (+ committed
  `.githooks/`) that runs the same gate locally so regressions are caught before
  the runner. _omp-free-text: missing ✗._
- [ ] **Release workflow** — tag-triggered (`v*`), builds artifacts, opens a
  **draft** release for a human to publish. _Tapa ships `release.yml` (signed,
  cross-platform binaries) as baseline. omp-free-text: **N/A — Tapa-baseline,
  artifact-only** (the plugin installs from GitHub source, no compiled artifact);
  a plain annotated tag (see Release & Versioning) already enables `#ref`
  pinning without a workflow._
- [ ] **Artifact size-budget gate** — a committed size budget
  (`size-budget.json` + a checker) failing CI when the shipped artifact grows
  past budget, with a human block-and-ask on growth. _Tapa ships this as
  baseline (`scripts/check-size.mjs`, a CI `size` job). omp-free-text: **N/A —
  Tapa-baseline, artifact-only** (no compiled artifact to size)._
- [ ] **`dependabot.yml`** — automated dependency-update PRs.
  _(optional — beyond the Tapa baseline; Tapa relies on the CI audit job
  instead.)_ _omp-free-text: missing ✗._
- [ ] **Scheduled / weekly build** — periodic artifacts-only build for
  inspection. _Tapa ships `weekly.yml` (cron Mon 06:00 UTC, all-platform
  artifacts-only build + size gate) as baseline. omp-free-text: **N/A —
  Tapa-baseline, artifact-only** (no compiled artifact to build periodically)._

## Code Quality & Conventions

- [x] **Committed linter/formatter config enforced by CI** — a single source of
  truth for style (Tapa: `biome.json`, run as `npm run lint`). _omp-free-text:
  have ✓ — `biome.json`, `bun run lint` enforced by CI._
- [x] **Strict TypeScript config** — `tsconfig.json` with strict mode,
  typechecked in CI. _omp-free-text: have ✓ — strict mode, `bun run typecheck`._
- [x] **Conventional Commits documented** — commit-message convention stated in
  CONTRIBUTING. _omp-free-text: have ✓ — explicitly required, in English._
- [x] **Tests present and run in CI** — unit tests covering the core logic,
  executed by the CI gate. _omp-free-text: have ✓ — `tests/` suite, `bun test`
  in CI, pure modules kept host-import-free for testability._
- [x] **Architecture / project layout documented** — README and/or CONTRIBUTING
  explain the module split and where logic lives. _omp-free-text: have ✓ —
  pure-module vs OMP-wiring split documented in CONTRIBUTING and the brief._

## Release & Versioning

- [x] **SemVer** — versioning policy stated and followed. _omp-free-text:
  have ✓ — stated in CHANGELOG._
- [x] **Keep a Changelog discipline** — `[Unreleased]` + dated version sections
  with Added/Changed/Fixed. _omp-free-text: have ✓._
- [x] **CHANGELOG compare/version links** — link references at the bottom of the
  changelog (`[Unreleased]: .../compare/vX...HEAD`, one per version) so each
  entry links to its diff. _omp-free-text: have ✓ — `[Unreleased]` + `[0.1.0]` refs._
- [x] **package.json version synced** — `version` matches the latest released
  tag. _omp-free-text: have ✓ — `0.1.0`._
- [ ] **Git tag per release** — annotated `vX.Y.Z` tag for each published
  version, enabling `#ref` install pinning. _omp-free-text: missing ✗ —
  confirmed zero tags/releases on the live repo (2026-06-22); cut an annotated
  `v0.1.0`._

## Discoverability / Metadata

- [x] **Complete package.json metadata** — `description`, `keywords`, `author`,
  `repository`, `homepage`, `bugs`. _omp-free-text: have ✓ — all present and
  well-targeted (`omp`, `oh-my-pi`, `extension`, `notes`, …)._
- [x] **README status badges** — release, license, and platform/runtime badges
  at the top. _omp-free-text: have ✓ — CI, license, and Bun-runtime badges._
- [x] **README table of contents** — anchored TOC for a long README.
  _omp-free-text: have ✓ — anchored "Contents" TOC._
- [ ] **Banner / logo image** — a `docs/` banner shown at the top of the README.
  _omp-free-text: missing ✗ — no `docs/banner.png` equivalent._
- [x] **Star call-to-action** — a short "⭐ star this" line in the README intro.
  _omp-free-text: have ✓ — "please ⭐ the repo" line in the intro._
- [ ] **GitHub repo description + topics** — one-line description and topic tags
  set on the repository itself. _omp-free-text: missing ✗ — confirmed empty
  description and zero topics on the live repo (2026-06-22). Set both at launch._

---

## Scorecard

- **Launch precondition (not a scored item):** the repo must be **Public** —
  it is currently **Private**, so `omp plugin install github:...` 404s until
  flipped. This is the overriding blocker.
- **Met today:** 29 of 37 items.
- **To close:** 8 items — most N/A, optional, or GitHub-settings-only.
- **Remaining in-tree gaps:** local pre-push hooks (`lefthook.yml`) and a
  README banner/logo image. Both are nice-to-haves, not launch blockers.
- **GitHub-settings-only** (cannot be set from the working tree, do at launch,
  all confirmed OPEN on 2026-06-22): annotated `vX.Y.Z` release tag (enables
  `#ref` pinning), repo description, and repo topics.
- **Items that are N/A for this project type** (a source-installed Bun
  extension, no compiled artifact): THIRD-PARTY-LICENSES, release workflow,
  weekly build, and the artifact size-budget gate — all Tapa-baseline but
  artifact-only. Optional/beyond-baseline: `dependabot.yml`, `FUNDING.yml`.
  Tracked, not blockers.

See [`launch-checklist.md`](./launch-checklist.md) for the actionable,
prioritized go-live list and the publicity plan.
