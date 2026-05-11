# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> **Upcoming: 2.0.0** — toolchain modernisation, native fetch, DMX512 support.
> Coverage gate ≥80% (lines/branches/functions/statements); project sits at
> 96.3% overall, 100% on parsers / interpreters / error classes / DMX module.

### Added
- **DMX512 support** — new `GetDmxService` (`/GetDmx.csv`) and `DmxService`
  (`/usrcfg.cgi` with the `DMX512=1` form payload), plus `GetDmxData` /
  `DmxChannelData` for read-mutate-write workflows. Mirrors the proconip-pypi
  surface.
- Typed error hierarchy: `ProconIpError`, `BadCredentialsError`,
  `BadStatusCodeError`, `RequestTimeoutError`, `InvalidPayloadError`. All
  exported from `'procon-ip'`.
- `coverage:report` script for the "find the last 20%" loop.
- `docs:check` script (TypeDoc with strict link / export validation).

### Changed
- Single TypeScript config; build outputs to `dist/` via tsup (one source of
  truth for both ESM and CJS, with bundled `.d.ts` and source maps).
- Released via changesets and npm Trusted Publishing (OIDC + provenance) from
  the `release` GitHub environment. No long-lived `NPM_TOKEN` in CI.
- Docs are built by `docs.yml` and deployed to GitHub Pages from Actions
  (the `docs/` HTML subtree is no longer committed).
- `UsrcfgCgiService.setOn` / `setOff` / `setAuto` return `Promise<void>`
  (was `Promise<number>`); failures throw the new typed error classes.
- Package manager: pnpm 9 (was Yarn 1 Classic, end-of-life).

### Removed (BREAKING)
- **Node ≤ 18** (`engines.node` is `>=20.0.0`).
- **`axios`** runtime dependency. All HTTP uses native `fetch`.
- **Deep imports** (`procon-ip/lib/...`, `procon-ip/module/...`). Use
  package-root imports only.
- **`mock-state`** public export. Move to `test/fixtures/` if you were
  depending on it; it was always a dev convenience.
- **Legacy `release-npmjs.yml` / `release-github.yml`** workflows.

### Migration

```diff
- import { GetStateService } from 'procon-ip/lib/get-state.service';
+ import { GetStateService } from 'procon-ip';
```

```diff
  try {
    await getStateService.update();
- } catch (e: AxiosError) {
-   if (e.response?.status === 401) handleAuth();
+ } catch (e) {
+   if (e instanceof BadCredentialsError) handleAuth();
    else throw e;
  }
```

```diff
- const code = await usrcfg.setOn(relay);
- if (code !== 200) handleFailure();
+ try {
+   await usrcfg.setOn(relay);
+ } catch (e) {
+   if (e instanceof BadStatusCodeError) handleFailure();
+   else throw e;
+ }
```

Bump your runtime to Node 20 LTS or newer.

[Unreleased]: https://github.com/ylabonte/procon-ip/compare/v1.8.0...HEAD
