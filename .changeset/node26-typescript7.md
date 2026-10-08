---
---

Tooling only, no change to the published package: CI now runs on Node 22, 24 and 26 (26 by default), and the dev toolchain moves to TypeScript 7, Vitest 5 and the other pending dev-dependency bumps. `.pnpmfile.cjs` keeps typescript-eslint, typedoc and tsup's dts bundler on the TS 6 compiler API until they support TS 7.
