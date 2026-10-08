// TypeScript 7 (the native Go compiler) no longer ships the JS compiler API
// that typescript-eslint, typedoc and tsup's dts bundler are built on.
// `tsc` (typecheck) runs on TS 7; these tools get Microsoft's side-by-side
// TS 6 API package instead. Drop a package from the list once it supports
// TS 7 natively (watch its `typescript` peer range).
const TS6_API = 'npm:@typescript/typescript6@^6.0.2';
const NEEDS_TS6_API = new Set([
  'typescript-eslint',
  '@typescript-eslint/eslint-plugin',
  '@typescript-eslint/parser',
  '@typescript-eslint/project-service',
  '@typescript-eslint/tsconfig-utils',
  '@typescript-eslint/type-utils',
  '@typescript-eslint/typescript-estree',
  '@typescript-eslint/utils',
  'ts-api-utils',
  'typedoc',
  'tsup',
]);

function readPackage(pkg) {
  if (NEEDS_TS6_API.has(pkg.name)) {
    if (pkg.peerDependencies) delete pkg.peerDependencies.typescript;
    if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta.typescript;
    pkg.dependencies = { ...pkg.dependencies, typescript: TS6_API };
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
