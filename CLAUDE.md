# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`procon-ip` is a TypeScript client library for the **ProCon.IP** pool controller. It is consumed by other Node projects (notably `ioBroker.procon-ip`) and published to npmjs.com. There is no runtime application here — only library code under `src/`, tests under `test/`, and the docs front-page at `docs/index.md` (TypeDoc-rendered into `site/` by CI).

The pool controller exposes a small, undocumented HTTP surface (`/GetState.csv`, `/usrcfg.cgi`, `/Command.htm`, `/SetState.pl`, `/GetDmx.csv`). Most of this library is a thin, typed wrapper around those endpoints plus the bit-twiddling needed to interpret relay state.

## Common commands

Package manager is **pnpm 9** — pinned via `packageManager` in `package.json`. The lockfile is `pnpm-lock.yaml`.

```bash
pnpm install            # install
pnpm build              # tsup -> dist/index.{mjs,cjs,d.ts,d.cts} + sourcemaps
pnpm lint               # ESLint over src/ + test/
pnpm lint:fix           # ESLint --fix
pnpm format             # Prettier write over src/**/*.ts + test/**/*.ts
pnpm format:check       # Prettier --check
pnpm typecheck          # tsc --noEmit
pnpm test               # vitest run
pnpm test:watch         # vitest in watch mode
pnpm coverage           # vitest run --coverage (CI gate ≥80% on all four metrics)
pnpm coverage:report    # coverage with --reporter=verbose (per-line uncovered output)
pnpm docs               # typedoc -> site/
pnpm docs:check         # typedoc with --validation.invalidLink --validation.notExported --treatWarningsAsErrors
pnpm changeset          # interactive: add a new changeset
pnpm release            # build + changeset publish (used by release.yml only — don't run locally)
```

`prepack` runs `pnpm build` so `pnpm publish` flows trigger it automatically. Tests, lint, and docs validation are NOT in `prepack` — they're enforced by CI.

## Build / packaging model

The package ships **dual ESM + CJS in one tarball** via tsup:

- `package.json` `exports`: `import` → `./dist/index.mjs` (ESM), `require` → `./dist/index.cjs` (CJS), `types` → `./dist/index.d.ts`.
- `main` points at `./dist/index.cjs`, `module` at `./dist/index.mjs`, `types` at `./dist/index.d.ts`.
- `files` ships `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`.
- Single `tsconfig.json` with `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `strict: true`, `noUncheckedIndexedAccess: true`, `isolatedModules: true`. tsup handles both module emissions from this one source of truth.
- `tsup.config.ts` defines the build (entry, formats, dts, sourcemaps, target node20).

`docs/` holds only the docs front-page source (`docs/index.md`); TypeDoc output goes to `site/` (gitignored) and is uploaded to GitHub Pages by `docs.yml`. **Don't commit `docs/assets/`, `docs/classes/`, etc.** — those were the old hand-regenerated subtree.

## Architecture

The library has two layers: **HTTP service classes** (one per controller endpoint) and **data/interpreter classes** (parse responses, manipulate bit-encoded relay state).

**Error model** (`src/errors.ts`): `ProconIpError` base + `BadCredentialsError` (HTTP 401/403), `BadStatusCodeError` (other 4xx/5xx, carries `status` + `statusText`), `RequestTimeoutError` (carries `timeoutMs`), `InvalidPayloadError` (parser failures). All exported from `'procon-ip'`. Network-level fetch failures propagate as native `TypeError`.

**Service layer** — all extend `AbstractService` (`src/abstract-service.ts`), which centralizes the **native `fetch`** wiring, basic-auth, `AbortController`-based timeout, status-code → typed-error mapping, and the shared `IServiceConfig` shape (`controllerUrl`, `basicAuth`, `username?`, `password?`, `timeout`, `requestHeaders?`). Subclasses set `_endpoint` and `_method` (typed `HttpMethod`):

- `GetStateService` (`/GetState.csv`, GET) — the polling engine. `start(successCb?, errorCb?, stopOnError?)` kicks off a self-rescheduling `setTimeout` loop driven by `updateInterval`. Tracks `_consecutiveFails` against `errorTolerance`; only invokes the error callback once the limit is hit. The recursive `autoUpdate()` schedules the next call **before** awaiting the current one, so a slow request can cause the effective interval to exceed `updateInterval`.
- `UsrcfgCgiService` (`/usrcfg.cgi`, POST) — switches relays. Composed with a `GetStateService` and a `RelayDataInterpreter`; uses the fluent `interpreter.evaluate(stateData).setOn|setOff|setAuto(relay)` chain (returns `[onMask, autoMask]`) and POSTs `ENA=<on>,<auto>&MANUAL=1`. **`setOn` / `setOff` / `setAuto` return `Promise<void>`**; failures throw the typed errors above.
- `CommandService` (`/Command.htm`, GET) — manual dosage (`MAN_DOSAGE=<target>,<seconds>`). Targets: chlorine / pH-minus / pH-plus. Bypasses `AbstractService.request()` because the URL needs a per-call query string; retries up to 3× internally before returning `-1`.
- `SetStateService` (`/SetState.pl`, GET) — generic relay on-timer. Same per-call URL pattern as `CommandService`. Public API takes seconds; controller wants ms — we multiply.
- `GetDmxService` (`/GetDmx.csv`, GET) — fetches and parses the 16 DMX channels into `GetDmxData`.
- `DmxService` (`/usrcfg.cgi`, POST) — pushes a `GetDmxData` back to the controller using the form-encoded `TYPE=0&LEN=16&CH1_8=...&CH9_16=...&DMX512=1` shape from `GetDmxData.toPostData()`.

**Data layer**:

- `GetStateData` parses the CSV from `/GetState.csv` and exposes typed accessors. `GetStateCategory` enum groups items (analog, electrodes, temperatures, relays, digital input, external relays, canister, etc.); `getDataObjectsByCategory()` is the primary read API. `categories` is static (with an instance-side getter for ergonomics).
- `GetStateDataObject` / `GetStateDataSysInfo` / `RelayDataObject` — typed views over individual rows / system-info bits. `GetStateDataSysInfo` exposes feature flags like `isElectrolysis()`, `isFlowSensorEnabled()`, `isDmxEnabled()`, plus accessors that map known dosage relays back to their indices.
- `RelayDataInterpreter` — handles the two-bit relay encoding (`RelayStateBitMask.on = 1`, `manual = 2`) and produces the `[onMask, autoMask]` decimal pair `usrcfg.cgi` expects. **All bit math lives here**; service classes should not duplicate it.
- `GetDmxData` / `DmxChannelData` — mutable representation of all 16 DMX channels. Iterable, indexable via `at()`, mutable via `set()` (clamps `[0, 255]`, throws `RangeError` on bad index), produces the form payload via `toPostData()`. The controller only accepts full 16-channel writes; the API mirrors that constraint.
- `Logger` / `ILogger` (`src/logger.ts`) — minimal default logger. **All services accept an `ILogger`** rather than calling `console` directly; preserve this when adding new services.

**Adding a new controller endpoint**: subclass `AbstractService`, set `_endpoint` and `_method`, add `Accept` / `Content-Type` headers in the constructor if needed, take an `ILogger` (and any required collaborators) as constructor args, use `this.request()` for the call. Re-export from `src/index.ts` (alphabetical) — that file is the public API surface.

## Versioning

Standard semver from 2.0.0 onward:

- **Major bump** for any breaking change (renamed/removed exports, signature changes that break callers, behavior changes that break observed contracts).
- **Minor bump** for new exports / new optional parameters / new behavior that doesn't break existing callers.
- **Patch bump** for bug fixes that don't change behavior.

Every change ships with a **changeset** (`pnpm changeset` to add one) describing the bump type and a one-paragraph summary. Breaking changes need a migration block in `CHANGELOG.md` (Keep-a-Changelog format) showing `old → new`. The `release.yml` workflow consumes the changeset and opens a "Version Packages" PR; merging it publishes.

## Lint / style

- ESLint **9.x flat config** in `eslint.config.mjs`, extends `@eslint/js` recommended + `typescript-eslint` `recommendedTypeChecked` (scoped to `src/**/*.ts` + `test/**/*.ts` only) + `eslint-config-prettier`. Prettier runs as an ESLint rule (`prettier/prettier: error`).
- The `@typescript-eslint/no-unsafe-*` family and `no-explicit-any` are **errors**, not warnings. Keep them that way — re-introducing `any` leaks should fail CI. If you need to interact with truly untyped data, use `unknown` + runtime guards.
- Prettier: `printWidth: 120`, `singleQuote: true`, `trailingComma: 'all'`.
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `isolatedModules: true`. Keep all three on.

## CI / release

`.github/workflows/`:

- `ci.yml` — pnpm install + format:check + lint + typecheck + build + coverage + docs:check on Node 20 and 22, on push/PR to `master`/`develop`/`feature/*`. Uploads `coverage/` artifact from the Node 22 job.
- `docs.yml` — on push to `master` and on release: builds TypeDoc with strict validation, uploads as Pages artifact, deploys to GitHub Pages from Actions (Pages source = "GitHub Actions").
- `release.yml` — on push to `master`, runs inside the **`release` GitHub environment** (deployment-branch policy restricts to `master`). Uses `changesets/action@v1` to either open a "Version Packages" PR or publish via `npm publish --provenance --access public`. **Publishes via npm Trusted Publishing (OIDC)**: `permissions: id-token: write` + `NPM_CONFIG_PROVENANCE: "true"`. No long-lived `NPM_TOKEN`.
- `codeql.yml` — JS/TS CodeQL on master + weekly schedule.
- `automerge.yml` — auto-approves and auto-merges Dependabot PRs on master.

Dependabot (`.github/dependabot.yml`) groups npm updates into `production` and `dev-dependencies` (daily), and bumps GitHub Actions weekly.

`.nvmrc` is **gitignored** (developer-local convenience). Node floor is `>=20.0.0` per `engines`.

## Workflow conventions for AI agents

When implementing work in this repo, Claude must:

- **Break every plan into tracked tasks.** When executing a multi-step plan (anything beyond a single trivial edit), use `TaskCreate` to record each step at the start and `TaskUpdate` to mark steps `in_progress` and `completed` as you go. The user relies on live task progress to follow the work. Do not batch updates at the end.
- **Pause at human-action checkpoints.** Any plan step that requires the user to act outside the editor — npm/GitHub/account configuration, secret creation or rotation, manual verification, deletions of shared resources, or any irreversible external change — must be flagged before you proceed and call out exactly what the user needs to do. Wait for confirmation; do not assume the action was taken.
- **Surface decisions, not just questions.** When a step has a meaningful choice the user should weigh in on, present 2–3 concrete options with trade-offs (use `AskUserQuestion`), don't ask open-ended "what do you want?" questions.
- **Plans and specs are local-only.** Implementation plans go to `docs/superpowers/plans/YYYY-MM-DD-<topic>-plan.md`; design specs to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. The directory is gitignored — these are process artefacts, not part of the published library or the GitHub repo. Don't `git add` them. Migration rationale belongs in `CHANGELOG.md` and commit messages, not in tracked plan/spec files.
- **Don't ship coverage regressions.** New code lands with tests; the CI gate enforces the floor (≥80% lines / branches / functions / statements). Above the floor, treat any *measurable* drop as a regression — not "did the gate trip?" but "did the number go down?". When you've touched code that's likely to move the needle (services, parsers, error paths, anything the test suite directly exercises), run `pnpm coverage` after the change and compare to the latest tracked baseline. If you've intentionally accepted a drop (e.g., deleting tested code, or because a path is now physically unreachable), say so explicitly. Don't run coverage rituals on changes that obviously can't affect it (config-only edits, action-version bumps, doc tweaks).

## Repo-specific gotchas

- `examples/` is a separate ESM sandbox project (`type: module`, depends on `procon-ip ^2.0.0`). It has its own `node_modules` (not committed); no `package-lock.json` is tracked. Don't run library scripts from inside it.
- `dist/`, `site/`, `coverage/` are gitignored build outputs. `lib/` and `module/` are gone (legacy v1 outputs).
- Test fixtures live in `test/fixtures/*.csv`. Don't inline CSV strings into test files.
- `mock-state` is no longer a public export (was a v1 dev convenience). The fixture form lives in `test/fixtures/get-state.csv`.
- `CONTRIBUTING.md` mentions a planned git-flow with a `develop` branch; the CI workflow already accepts `develop` and `feature/*` branches. Default branch is `master`.
