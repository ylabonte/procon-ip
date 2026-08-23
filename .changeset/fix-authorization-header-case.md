---
'procon-ip': patch
---

Fix authenticated relay/DMX writes returning **401** against the ProCon.IP controller. `AbstractService.request()` built its headers through the WHATWG `Headers` API, which lowercases every header name, so undici sent `authorization: …` on the wire. The controller's legacy firmware is **case-sensitive on the header name** and rejects a write carrying `authorization`, accepting only `Authorization` (verified end-to-end against a real ProCon.IP V.1.7.6: lowercase → 401, capitalised → 200 `done`). Reads were unaffected because their endpoints ignore auth. Request headers are now assembled as a plain object so their exact casing reaches the wire; a real-wire regression test asserts the outgoing `Authorization` name is capitalised.
