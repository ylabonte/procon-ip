---
---

Tooling only, no change to the published package: the build switches from tsup to tsdown (Rolldown-based successor of tsup). The `dist/` output is equivalent — same files and names, same runtime exports in ESM and CJS, same type declarations. tsup drops out of the `.pnpmfile.cjs` TypeScript 6 API workaround because tsdown emits declarations with the TypeScript 7 compiler.
