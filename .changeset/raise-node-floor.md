---
'procon-ip': major
---

Drop Node 20 support. Minimum supported runtime is now **Node 22 LTS**.

- `engines.node` raised from `>=20.0.0` to `>=22.0.0`.
- CI matrix bumped from Node 20/22 to Node 22/24.
- `tsup` compilation target raised from `node20` to `node22`.

**Migration**: bump your runtime to Node 22 LTS or newer.
