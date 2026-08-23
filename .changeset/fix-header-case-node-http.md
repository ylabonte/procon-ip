---
'procon-ip': patch
---

Fix relay/DMX **writes** being silently dropped by the controller (they returned `200 "done"` but never applied). Root cause: the ProCon.IP's legacy HTTP/1.0 firmware is **case-sensitive on header names** and reads a POST body only when the length header is spelled `Content-Length`. `undici` (and the global `fetch`) lowercase the header names they generate, so every write went out with `content-length` — the firmware ignored the body and no-op'd the write. This is the same class of bug as the `Authorization` casing fixed in 2.1.3, but on a header the HTTP client generates and won't let us re-case.

The HTTP transport is now Node's built-in `http`/`https` (new `src/http-transport.ts`), which preserves the exact casing of every header we set and adds only a capitalised `Host`. **`undici` is removed — the package is now zero runtime dependencies.** Verified end-to-end against a real ProCon.IP V.1.7.6: a `DmxService` write followed by a `GetDmxService` read-back now echoes the written value (previously it stayed unchanged). A real-wire regression test asserts the outgoing `Content-Length` (and `Authorization`) name reaches the wire capitalised.
