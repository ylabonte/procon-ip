---
'procon-ip': minor
---

Drop Node 20 support. Minimum supported runtime is now **Node 22 LTS**.

- `engines.node` raised from `>=20.0.0` to `>=22.0.0`.
- CI matrix bumped from Node 20/22 to Node 22/24.
- `tsup` compilation target raised from `node20` to `node22`.

The library's runtime API is unchanged; consumers on Node 22+ are unaffected. Consumers on Node 20 should bump their runtime to Node 22 LTS or newer.
