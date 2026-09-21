import eslintBase from '../../eslint.base.mjs';

export default eslintBase({
  packageDir: import.meta.dirname,
  publicFiles: [],
  nodeFiles: ['internal/**/*.ts'],
  // The generators and the fork-url runner are the only TypeScript here; explicit return types, like common/.
  returnTypeFiles: ['internal/**/*.ts'],
});
