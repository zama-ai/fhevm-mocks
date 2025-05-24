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

const config = [
  // 0
  {
    ignores: ["src/_types/*", "src/_cjs/*", "src/_esm/*", "coverage/*"],
  },
  // 1
  ...compat.extends("eslint:recommended", "prettier"),
  // 2
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
  // 3
  ...compat
    .extends(
      "eslint:recommended",
      "plugin:@typescript-eslint/strict",
      "plugin:@typescript-eslint/strict-type-checked",
      "prettier",
    )
    .map((config) => ({
      ...config,
      files: ["**/*.ts"],
      ignores: ["./dist/**/*.js", "./typechain-types/*"],
      rules: {
        "@typescript-eslint/no-floating-promises": "error",
      },
    })),
  // 4
  {
    files: ["**/*.ts"],
    ignores: [
      "./dist/**/*.js",
      "src/_types/**/*.js",
      "src/_esm/**/*.js",
      "src/_cjs/**/*.js",
      "./tmp/*",
      "./coverage/*",
    ],
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
  // 5 - Forbid "Buffer"
  {
    files: ["./src/**/*.{js,ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "Buffer",
          message: "Avoid using Buffer in internal/libs. Use a custom abstraction if needed.",
        },
      ],
    },
  },
];

export default config;
