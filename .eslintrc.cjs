module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier', // Make sure this is last in the extends array
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'logs', '.gallerify'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'prettier'],
  overrides: [
    { files: ['scripts/worktree-dev/*.mjs'], env: { browser: false, node: true, es2022: true } },
  ],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // 'prettier/prettier': 'warn',
  },
};
