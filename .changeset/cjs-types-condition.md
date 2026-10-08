---
'procon-ip': patch
---

Fix type resolution for CommonJS consumers using `moduleResolution: node16`/`nodenext`. `exports` now has separate `types` for the `import` and `require` conditions, so `require('procon-ip')` / `import x = require('procon-ip')` get the CommonJS declarations (`dist/index.d.cts`) instead of the ESM ones. Previously TypeScript reported TS1471 ("The specifier only resolves to an ES module, which cannot be imported with 'require'") even though the runtime CJS build worked. Runtime code is unchanged.
