# Changelog

## 2.1.4

### Patch Changes

- c5a0476: Fix relay/DMX **writes** being silently dropped by the controller (they returned `200 "done"` but never applied). Root cause: the ProCon.IP's legacy HTTP/1.0 firmware is **case-sensitive on header names** and reads a POST body only when the length header is spelled `Content-Length`. `undici` (and the global `fetch`) lowercase the header names they generate, so every write went out with `content-length` — the firmware ignored the body and no-op'd the write. This is the same class of bug as the `Authorization` casing fixed in 2.1.3, but on a header the HTTP client generates and won't let us re-case.

  The HTTP transport is now Node's built-in `http`/`https` (new `src/http-transport.ts`), which preserves the exact casing of every header we set and adds only a capitalised `Host`. **`undici` is removed — the package is now zero runtime dependencies.** Verified end-to-end against a real ProCon.IP V.1.7.6: a `DmxService` write followed by a `GetDmxService` read-back now echoes the written value (previously it stayed unchanged). A real-wire regression test asserts the outgoing `Content-Length` (and `Authorization`) name reaches the wire capitalised.

## 2.1.3

### Patch Changes

- 5e37d9f: Fix authenticated relay/DMX writes returning **401** against the ProCon.IP controller. `AbstractService.request()` built its headers through the WHATWG `Headers` API, which lowercases every header name, so undici sent `authorization: …` on the wire. The controller's legacy firmware is **case-sensitive on the header name** and rejects a write carrying `authorization`, accepting only `Authorization` (verified end-to-end against a real ProCon.IP V.1.7.6: lowercase → 401, capitalised → 200 `done`). Reads were unaffected because their endpoints ignore auth. Request headers are now assembled as a plain object so their exact casing reaches the wire; a real-wire regression test asserts the outgoing `Authorization` name is capitalised.

## 2.1.2

### Patch Changes

- 939a611: Fix `GetStateDataSysInfo.isDmxEnabled()`: DMX512 output is bit 2 (mask 4) of `configOtherEnable`, not bit 8 (mask 256). Verified against a real ProCon.IP (`configOtherEnable` reads 0 with DMX off and 4 with DMX on). The old mask reported the separate SPI/DMX _extension_ flag, now exposed as the new `isDmxExtensionEnabled()`. This matches the proconip-pypi / Home Assistant behaviour.

## 2.1.1

### Patch Changes

- d42a13d: Fix relay switching (`UsrcfgCgiService`) and DMX writes (`DmxService`), which were silently failing against real controllers since the 2.x rewrite. Two root causes, both now fixed:

  1. **Browser headers from `fetch()`.** `AbstractService.request()` used the global `fetch()`, whose WHATWG implementation injects browser-only request headers (`sec-fetch-mode`, `accept-language`, `accept`, `user-agent`). The controller's legacy firmware accepts such a write with `200 "done"` but silently ignores it (reads were unaffected). Those headers are on the fetch "forbidden header" list and cannot be stripped via the API, so the HTTP layer now uses **`undici.request()`** (new runtime dependency), which sends only the headers we set. This is what `axios` (pre-2.x) and other working clients did.

     Side effects of the HTTP-client switch: `request()` no longer follows 3xx redirects (they surface as `BadStatusCodeError`), and `statusText` on `BadStatusCodeError` / the returned `Response` is now the numeric status. No caller relies on either.

  2. **Percent-encoded comma.** The `/usrcfg.cgi` POST body was serialised with `URLSearchParams`, encoding the literal comma in `ENA=<on>,<auto>` (and the DMX `CH1_8`/`CH9_16` channel lists) to `%2C`, which the controller cannot parse. The body is now built with literal commas.

  Both were confirmed against a real `ProCon.IP V.1.7.6` (relay physically toggles again). A new wire-level regression test asserts the outgoing request carries neither the browser headers nor a percent-encoded comma.

## 2.1.0

### Minor Changes

- 0779ff3: Drop Node 20 support. Minimum supported runtime is now **Node 22 LTS**.
  - `engines.node` raised from `>=20.0.0` to `>=22.0.0`.
  - CI matrix bumped from Node 20/22 to Node 22/24.
  - `tsup` compilation target raised from `node20` to `node22`.

  The library's runtime API is unchanged; consumers on Node 22+ are unaffected. Consumers on Node 20 should bump their runtime to Node 22 LTS or newer.

## 2.0.0

### Major Changes

- 4993dbd: procon-ip 2.0.0 — toolchain modernisation, native fetch, DMX512 support.

  Breaking changes:
  - Drop Node ≤ 18 (`engines.node: ">=20.0.0"`).
  - Replace `axios` with native `fetch`. Errors are now `BadCredentialsError`,
    `BadStatusCodeError`, `RequestTimeoutError`, `InvalidPayloadError` (all
    exported from `'procon-ip'`). `AxiosError` is no longer leaked.
  - Drop deep imports — only `import { X } from 'procon-ip'` works. The
    `procon-ip/lib/...` and `procon-ip/module/...` paths are removed.
  - Build outputs move to `dist/` (was `lib/` + `module/`). The package
    `exports` map preserves the public import surface.
  - `mock-state` is no longer a public export.
  - `UsrcfgCgiService.setOn` / `setOff` / `setAuto` now return `Promise<void>`.
    The opaque numeric response code returned in 1.x is dropped; failures
    throw the new typed error classes instead.

  New:
  - DMX512 support via `GetDmxService`, `DmxService`, `GetDmxData`,
    `DmxChannelData`. Read-mutate-write idiom mirroring proconip-pypi.

  Internal:
  - pnpm 9 + tsup + Vitest + ESLint 9 flat + TypeDoc with strict validation.
  - ≥80% coverage gate in CI; project targets 100% on parsers/interpreters/
    error paths/DMX (currently 96.3% overall, 100% on parsers/interpreters/
    errors/DMX).
  - Releases publish via npm Trusted Publishing (OIDC + provenance) inside
    the `release` GitHub environment. No long-lived `NPM_TOKEN` in CI.
  - Docs are built and deployed to Pages from Actions; the previously
    committed `docs/` HTML is removed.

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
- **`SetStateValue` enum** export. It was effectively unreachable from
  user code (the only public method that consumed it was a private
  internal in v1). The `setOn` / `setOff` / `setAuto` wrappers remain
  the only documented relay-switching API.
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
