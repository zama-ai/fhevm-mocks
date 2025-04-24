import { FlatCompat } from "@eslint/eslintrc";
import eslint from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: eslint.configs.recommended,
  allConfig: eslint.configs.all,
});

export default [
  {
    ignores: ["dist/*", "typechain-types/*"],
  },
  ...compat.extends("eslint:recommended", "prettier"),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.mocha,
        artifacts: "readonly",
        contract: "readonly",
        web3: "readonly",
        extendEnvironment: "readonly",
        expect: "readonly",
      },
    },
  },
  ...compat.extends("eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier").map((config) => ({
    ...config,
    files: ["**/*.ts"],
    ignores: ["./dist/**/*.js", "./typechain-types/*"],
  })),
  {
    files: ["**/*.ts"],
    ignores: ["./dist/**/*.js", "./typechain-types/*"],

    plugins: {
      "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
];
