---
'procon-ip': patch
---

Fix relay switching (`UsrcfgCgiService`) and DMX writes (`DmxService`), which were silently failing against real controllers since the 2.x rewrite. Two root causes, both now fixed:

1. **Browser headers from `fetch()`.** `AbstractService.request()` used the global `fetch()`, whose WHATWG implementation injects browser-only request headers (`sec-fetch-mode`, `accept-language`, `connection: keep-alive`). The controller's legacy firmware accepts such a write with `200 "done"` but silently ignores it (reads were unaffected). Those headers are on the fetch "forbidden header" list and cannot be stripped via the API, so the HTTP layer now uses **`undici.request()`** (new runtime dependency), which sends only the headers we set. This is what `axios` (pre-2.x) and other working clients did.

2. **Percent-encoded comma.** The `/usrcfg.cgi` POST body was serialised with `URLSearchParams`, encoding the literal comma in `ENA=<on>,<auto>` (and the DMX `CH1_8`/`CH9_16` channel lists) to `%2C`, which the controller cannot parse. The body is now built with literal commas.

Both were confirmed against a real `ProCon.IP V.1.7.6` (relay physically toggles again). A new wire-level regression test asserts the outgoing request carries neither the browser headers nor a percent-encoded comma.
