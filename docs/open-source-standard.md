# The Tapa standard

The bar every `aryrabelo` open-source repo should clear before it goes public,
reverse-engineered from [`tapa-rs`](https://github.com/aryrabelo/tapa) — the
reference repo for this standard.

Each item below is a checkbox, a one-line statement of what it must contain, and
an inline note on **omp-free-text's current state** (`have ✓` / `missing ✗`).
Checked boxes are what the project already meets today; unchecked boxes are the
gap to close before launch.

> Notes on scope: a few items Tapa itself does **not** ship as separate files
> (standalone Code of Conduct, `FUNDING.yml`, `dependabot.yml`, weekly build).
> Tapa folds conduct into CONTRIBUTING and handles dependency hygiene with a CI
> audit job. Those are marked **(optional — beyond the Tapa baseline)** so the
> baseline stays honest.

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
  hand-curated). _omp-free-text: missing ✗ — arguably **N/A**: the extension
  ships only `src/` (see package.json `files`) and bundles no third-party code
  (`@oh-my-pi/pi-coding-agent` is a peer/dev dependency, not redistributed).
  Add only if a build step ever bundles runtime deps. <<EXPANDIR: confirm no
  bundling step is added before launch.>>_

## Documentation

- [x] **README that sells and orients** — what it is and the "why", install,
  usage, verification commands, and a license line. _omp-free-text: have ✓ —
  thorough README covering install/usage/storage/dev._
- [ ] **README: explicit "Non-goals / scope" section** — states what the project
  deliberately will not do, so feature requests self-filter (Tapa's
  "Non-goals (v1)"). _omp-free-text: missing ✗ — the honest non-goals exist in
  the product brief (inline editable panel, history-version browsing, clickable
  widget, Herdr companion pane) but are not in the README._
- [x] **CONTRIBUTING.md** — prerequisites, setup, the exact verification gate a
  PR must pass, conventions, and how to dev-install. _omp-free-text: have ✓ —
  covers Bun setup, `bun run typecheck && bun test`, module discipline,
  Conventional Commits._
- [x] **CHANGELOG.md** — Keep a Changelog format, adheres to SemVer, with an
  `[Unreleased]` section. _omp-free-text: have ✓ — correct format and sections._
- [ ] **SECURITY.md** — private vulnerability-reporting channel (GitHub advisory
  + email), what to include, response expectation, and supported versions.
  _omp-free-text: missing ✗._

## Community Health (`.github/`)

- [ ] **Bug report issue template** — structured form (`bug_report.yml`) with
  what-happened, repro steps, OS, and version fields. _omp-free-text: missing ✗._
- [ ] **Feature request issue template** — structured form
  (`feature_request.yml`) that asks for the problem, not just the solution, with
  a scope-check tied to Non-goals. _omp-free-text: missing ✗._
- [ ] **ISSUE_TEMPLATE/config.yml** — `blank_issues_enabled: false` and a
  security contact link routing vulnerabilities to private reporting.
  _omp-free-text: missing ✗._
- [ ] **pull_request_template.md** — "what changed", related issue, and a
  checklist mirroring the CI gate (lint/test/build/docs/scope).
  _omp-free-text: missing ✗._
- [ ] **Code of Conduct** — at minimum a "be respectful and constructive"
  section inside CONTRIBUTING (the Tapa baseline); a standalone
  `CODE_OF_CONDUCT.md` is the fuller form. _omp-free-text: missing ✗ — neither
  inline nor standalone._
- [ ] **FUNDING.yml** — sponsorship links shown in the GitHub sidebar.
  _(optional — beyond the Tapa baseline; Tapa ships none.)_ _omp-free-text:
  missing ✗._

## CI & Automation

- [x] **CI workflow on push + PR** — runs the full verification gate
  (lint/typecheck, test, build) on every push and pull request.
  _omp-free-text: have ✓ — `.github/workflows/ci.yml` runs `bun run typecheck` +
  `bun test`. Enhance: add `build` if/when one exists._
- [ ] **Least-privilege + concurrency on CI** — `permissions: contents: read`
  and a `concurrency` group that cancels superseded runs; scope triggers to
  `branches: [main]`. _omp-free-text: missing ✗ — CI has no `permissions`, no
  `concurrency`, and triggers on all branches._
- [ ] **Dependency audit job** — an advisory (`continue-on-error`) CI job running
  the ecosystem auditor (Tapa: `npm audit` + `cargo audit`). _omp-free-text:
  missing ✗ — add a `bun audit` / dependency-review job._
- [ ] **Local pre-push hooks mirroring CI** — a `lefthook.yml` (+ committed
  `.githooks/`) that runs the same gate locally so regressions are caught before
  the runner. _omp-free-text: missing ✗._
- [ ] **Release workflow** — tag-triggered (`v*`), builds artifacts, opens a
  **draft** release for a human to publish. _omp-free-text: missing ✗ —
  partly N/A (the plugin installs from GitHub source via `omp plugin install`,
  no compiled artifact), but a tag-on-version flow still enables `#ref` pinning._
- [ ] **`dependabot.yml`** — automated dependency-update PRs.
  _(optional — beyond the Tapa baseline; Tapa relies on the CI audit job
  instead.)_ _omp-free-text: missing ✗._
- [ ] **Scheduled / weekly build** — periodic artifacts-only build for
  inspection. _(optional — beyond the Tapa baseline applicability; N/A without a
  compiled artifact.)_ _omp-free-text: missing ✗ (N/A)._

## Code Quality & Conventions

- [ ] **Committed linter/formatter config enforced by CI** — a single source of
  truth for style (Tapa: `biome.json`, run as `npm run lint`). _omp-free-text:
  missing ✗ — relies on `tsc` strict only; no Biome/ESLint formatter config._
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
- [ ] **CHANGELOG compare/version links** — link references at the bottom of the
  changelog (`[Unreleased]: .../compare/vX...HEAD`, one per version) so each
  entry links to its diff. _omp-free-text: missing ✗ — entries have no link refs._
- [x] **package.json version synced** — `version` matches the latest released
  tag. _omp-free-text: have ✓ — `0.1.0`._
- [ ] **Git tag per release** — annotated `vX.Y.Z` tag for each published
  version, enabling `#ref` install pinning. _omp-free-text: missing ✗
  <<EXPANDIR: confirm release tags on GitHub; not verifiable from working tree.>>_

## Discoverability / Metadata

- [x] **Complete package.json metadata** — `description`, `keywords`, `author`,
  `repository`, `homepage`, `bugs`. _omp-free-text: have ✓ — all present and
  well-targeted (`omp`, `oh-my-pi`, `extension`, `notes`, …)._
- [ ] **README status badges** — release, license, and platform/runtime badges
  at the top. _omp-free-text: missing ✗._
- [ ] **README table of contents** — anchored TOC for a long README.
  _omp-free-text: missing ✗ (README is long enough to warrant one)._
- [ ] **Banner / logo image** — a `docs/` banner shown at the top of the README.
  _omp-free-text: missing ✗ — no `docs/banner.png` equivalent._
- [ ] **Star call-to-action** — a short "⭐ star this" line in the README intro.
  _omp-free-text: missing ✗._
- [ ] **GitHub repo description + topics** — one-line description and topic tags
  set on the repository itself. _omp-free-text: <<EXPANDIR: set/verify on the
  GitHub repo settings; not in the working tree.>>_

---

## Scorecard

- **Met today:** 15 of 36 items.
- **To close before launch:** 21 items.
- **Highest-leverage gaps** (present in the Tapa baseline, cheap to add): the
  whole `.github/` set (bug + feature templates, config, PR template), SECURITY.md,
  CODE_OF_CONDUCT, CHANGELOG compare links, README Non-goals + badges, and the CI
  hardening (`permissions` + `concurrency` + audit job).
- **Items that are N/A or optional for this project type** (a source-installed
  Bun extension, no compiled artifact): THIRD-PARTY-LICENSES, release/weekly
  build workflows, `dependabot.yml`, `FUNDING.yml`. Track them, but they are not
  blockers.
