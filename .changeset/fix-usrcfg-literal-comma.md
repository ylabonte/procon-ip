---
'procon-ip': patch
---

Fix relay switching (`UsrcfgCgiService`) and DMX writes (`DmxService`). The `/usrcfg.cgi` POST body was serialised with `URLSearchParams`, which percent-encodes the literal comma in `ENA=<on>,<auto>` (and the DMX `CH1_8` / `CH9_16` channel lists) to `%2C`. The controller's legacy firmware cannot parse the encoded comma and resets the connection — surfacing as `ECONNRESET` / "fetch failed" — so the relay or DMX channel never changed. The form body is now built with literal commas, matching the wire format the controller (and the pre-2.x, axios-based client) expects.
