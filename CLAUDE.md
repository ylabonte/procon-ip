# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`procon-ip` is a TypeScript client library for the **ProCon.IP** pool controller. It is consumed by other Node projects (notably `ioBroker.procon-ip`) and published to both npmjs.com and the GitHub npm registry. There is no runtime application here — only library code under `src/`, build outputs, and auto-generated TypeDoc HTML in `docs/`.

The pool controller exposes a small, undocumented HTTP surface (`/GetState.csv`, `/usrcfg.cgi`, `/Command.htm`, `/SetState.pl`). Most of this library is a thin, typed wrapper around those endpoints plus the bit-twiddling needed to interpret relay state.

## Common commands

Package manager is **Yarn 1 (Classic)** — pinned via `packageManager` in `package.json`. Do not switch to npm or pnpm without an explicit ask.

```bash
yarn                    # install
yarn run build          # build both ESM (module/) and CommonJS (lib/) outputs
yarn run build:esmodule # ESM only — tsconfig.json -> module/
yarn run build:commonjs # CJS only — tsconfig-commonjs.json -> lib/
yarn run build:docs     # regenerate docs/ via TypeDoc (wipes docs/ first, then re-creates it with .nojekyll)
yarn run build:all      # build + build:docs
yarn run lint           # ESLint over src/**
yarn run lint:fix       # ESLint --fix
yarn run format         # Prettier write over src/**/*.ts
```

There is **no test suite or test runner configured yet** — `yarn test` will fail. Don't claim "tests pass" until one exists.

`prepack` runs `build`, and `prepublishOnly` runs `lint`, so publish flows trigger both automatically.

## Build / packaging model (important)

The package ships **two builds in one tarball** to support both module systems without consumers caring:

- `package.json` `exports`: `import` -> `./module/index.js` (ESM), `require` -> `./lib/index.js` (CJS).
- `main` and `module` both point at the ESM build; `files` ships `module/` and `lib/`.
- ESM build: `tsconfig.json` -> `module/`, `module: ES2020`, `target: ES2015`.
- CJS build: `tsconfig-commonjs.json` extends the ESM one and overrides `module: CommonJS`, `outDir: ./lib`.

When changing TS config, change **both** files (or the extension chain) and verify both outputs still load. The README has CommonJS and ESM usage snippets that act as the de facto API contract — keep the public surface compatible with both.

`docs/` is checked in. The `build:docs` script does `rm -rf docs && typedoc ... && touch docs/.nojekyll` — re-running it produces a large, noisy diff. Only regenerate when the public API actually changed, and commit the result in a dedicated commit.

## Architecture

The library has two layers: **HTTP service classes** (one per controller endpoint) and **data/interpreter classes** (parse responses, manipulate bit-encoded relay state).

**Service layer** — all extend `AbstractService` (`src/abstract-service.ts`), which centralizes the axios request config, basic-auth wiring, base URL joining, and the shared `IServiceConfig` shape (`controllerUrl`, `basicAuth`, `username`, `password`, `timeout`). Subclasses set `_endpoint` and `_method`:

- `GetStateService` (`/GetState.csv`, GET) — the polling engine. `start(successCb?, errorCb?, stopOnError?)` kicks off a self-rescheduling `setTimeout` loop driven by `updateInterval`. Tracks `_consecutiveFails` against `errorTolerance`; only invokes the error callback once the limit is hit. The recursive `autoUpdate()` schedules the next call **before** awaiting the current one, so a slow request can cause the effective interval to exceed `updateInterval`. Backwards compat: signature additions (e.g. `stopOnError`) must stay optional.
- `UsrcfgCgiService` (`/usrcfg.cgi`, POST) — switches relays. Composed with a `GetStateService` and a `RelayDataInterpreter`; reads current relay states from the former, builds the on/off + auto/manual bit patterns via the latter, and POSTs both decimal values at once. `setOn` / `setOff` / `setAuto` are wrappers over `setState(SetStateValue)`.
- `CommandService` (`/Command.htm`, GET) — manual dosage (`MAN_DOSAGE=<target>,<seconds>`). Targets: chlorine / pH-minus / pH-plus. Retries up to 3× internally before returning `-1`.
- `SetStateService` (`/SetState.pl`, GET) — generic relay on-timer. Note the duration is sent as `RT{n}=<duration*1000>` (controller expects ms) while the public API takes seconds.

**Data layer**:

- `GetStateData` parses the CSV from `/GetState.csv` and exposes typed accessors. `GetStateCategory` enum groups items (analog, electrodes, temperatures, relays, digital input, external relays, canister, etc.); `getDataObjectsByCategory()` is the primary read API. `categories` is static (with a backward-compatible instance-side accessor — see v1.5.0 changelog).
- `GetStateDataObject` / `GetStateDataSysInfo` / `RelayDataObject` — typed views over individual rows / system-info bits. `GetStateDataSysInfo` exposes feature flags like `isElectrolysis()`, `isFlowSensorEnabled()`, `isDmxEnabled()`, plus accessors that map known dosage relays back to their indices.
- `RelayDataInterpreter` — handles the two-bit relay encoding (`RelayStateBitMask.on = 1`, `manual = 2`) and produces the `[onMask, autoMask]` decimal pair `usrcfg.cgi` expects. All bit math lives here; `UsrcfgCgiService` should not duplicate it.
- `Logger` / `ILogger` (`src/logger.ts`) — minimal default logger. **All services accept an `ILogger`** rather than calling `console` directly; preserve this when adding new services.
- `mock-state.ts` — canned CSV used for offline/dev experimentation.

**Adding a new controller endpoint**: subclass `AbstractService`, set `_endpoint` and `_method`, add `Accept` / `Content-Type` headers in the constructor if needed, take an `ILogger` (and any required collaborators) as constructor args. Re-export from `src/index.ts` — that file is the public API surface.

## Versioning posture (v2.0.0 in flight)

The repo is being rebuilt toward a **v2.0.0 release** that explicitly allows breaking changes where they remove friction or unblock best practices. The historical "1.x is strictly additive" rule does **not** apply to work happening on this branch.

Guidance for v2 work:

- Breaking changes are allowed when they enable a meaningfully cleaner API, types, build, or test setup. Don't break things gratuitously, but don't contort the design to preserve every 1.x signature either.
- **Every breaking change must be documented** in `CHANGELOG.md` (Keep-a-Changelog format) under the `Unreleased` / `2.0.0` section, with a short migration note (old → new).
- The dual ESM + CJS contract via `exports` should be kept where it doesn't restrict the design — consumers in both module systems are real.
- Once 2.0.0 ships, semver applies again strictly: 2.x stays additive.

## Lint / style

- ESLint **9.x flat config** in `eslint.config.mjs`, extends `@eslint/js` recommended + `typescript-eslint` recommendedTypeChecked + `eslint-config-prettier`, and runs Prettier as an ESLint rule (`prettier/prettier: error`).
- The `@typescript-eslint/no-unsafe-*` family and `no-explicit-any` are downgraded to **warnings**, not errors — much of the existing code that interprets axios responses uses `any` with scoped `eslint-disable` blocks. Don't blanket-disable these globally; keep the localized disables when interacting with raw response shapes.
- Prettier: `printWidth: 120`, `singleQuote: true`, `trailingComma: 'all'`.
- `tsconfig.json` has `strict: true`. Keep it on.

## CI / release

`.github/workflows/`:

- `ci.yml` — build + lint on Node 18 and 20, on push/PR to `master`/`develop`/`feature/*`.
- `codeql.yml` — JS/TS CodeQL on master + weekly schedule.
- `release-npmjs.yml` — triggered by GitHub Release; publishes to npmjs.com using `NPM_TOKEN`.
- `release-github.yml` — triggered by completion of the npmjs release; rewrites the package name to `@ylabonte/procon-ip` via `sed` then publishes to the GitHub npm registry using `GITHUB_TOKEN`.
- `automerge.yml` — auto-approves and auto-merges Dependabot PRs on master.

Dependabot (`.github/dependabot.yml`) groups updates into `production` and `dev-dependencies` and runs daily.

`.nvmrc` currently pins `v12.18.4` and is **stale** — actual supported Node is **18.18+** (per the v1.8.0 changelog; CI tests 18/20). Don't trust `.nvmrc` over `package.json` / CI.

## Repo-specific gotchas

- `examples/` has its own `node_modules` and `package-lock.json` — it's a separate sandbox project, not part of the library build. Don't run library scripts from inside it.
- `lib/` and `module/` are **gitignored build outputs**, but `docs/` is **checked in** — different rules, same kind of generated content.
- `CONTRIBUTING.md` mentions a planned git-flow with a `develop` branch; the CI workflow already accepts `develop` and `feature/*` branches. Default branch is currently `master`.
