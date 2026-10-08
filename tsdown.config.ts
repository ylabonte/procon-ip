import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // Keep the file names `package.json` `exports` points at.
  outExtensions: ({ format }) => (format === 'es' ? { js: '.mjs', dts: '.d.ts' } : { js: '.cjs', dts: '.d.cts' }),
  dts: true,
  sourcemap: true,
  clean: true,
  platform: 'node',
  target: 'node22',
  treeshake: true,
  hooks: {
    // rolldown-plugin-dts drops the .d.ts.map files but leaves their
    // `sourceMappingURL` comment behind in the declarations. The hook fires
    // once per format, so only touch the declarations this build emitted —
    // the other format may still be writing its own.
    'build:done': async ({ chunks }) => {
      for (const { outDir, fileName } of chunks) {
        if (!/\.d\.c?ts$/.test(fileName)) continue;
        const file = join(outDir, fileName);
        const code = await readFile(file, 'utf8');
        await writeFile(file, code.replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n'));
      }
    },
  },
});
