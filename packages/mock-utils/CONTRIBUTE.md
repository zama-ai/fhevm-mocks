## 🧾 Notes on `tsconfig` Structure (Dual Build: ESM + CommonJS)

To build a pure ESM lib. Do not specify "type" in package.json

View full esm config

```
npx tsc --showConfig -p tsconfig.esm.json
```

View full commmonjs config

```
npx tsc --showConfig -p tsconfig.commmonjs.json
```

View full VSCode config

```
npx tsc --showConfig -p tsconfig.json
```

This project uses a dual TypeScript build setup to support both **ESM** and **CommonJS** output formats. Below is a
breakdown of each `tsconfig` file and its role:

- **`tsconfig.json`**  
  ➤ Base config used exclusively by **VSCode** and developer tooling for type-checking and IntelliSense.  
  ➤ It does **not emit** any build output.  
  ➤ Internally extends `tsconfig.esm.json` to reflect the ESM module layout during development.

- **`tsconfig.esm.json`**  
  ➤ Used for building the **ESM** version of the package.  
  ➤ Output is written to the `lib.esm/` directory.  
  ➤ Uses `"module": "NodeNext"` or `"ESNext"` depending on the ESM target.  
  ➤ Typically includes `"declaration": true` and `emitDeclarationOnly`.

- **`tsconfig.commonjs.json`**  
  ➤ Used for building the **CommonJS** version of the package.  
  ➤ Output is written to the `lib.commonjs/` directory.  
  ➤ Uses `"module": "CommonJS"`.  
  ➤ Must also have `"declaration": true` if it is marked as `"composite": true`.

> 🔁 These builds are kept isolated to prevent conflicting formats, and they can be used in parallel or as needed
> depending on runtime or publishing context.

"build": "pnpm clean && pnpm build:cjs && pnpm build:esm && pnpm build:types", "build:cjs": "pnpm
build:trustedSetups:start && tsc --project ./tsconfig.build.json --module commonjs --moduleResolution node --outDir
./src/\_cjs --removeComments --verbatimModuleSyntax false && printf '{\"type\":\"commonjs\"}' > ./src/\_cjs/package.json
&& pnpm build:trustedSetups:end", "build:esm": "tsc --project ./tsconfig.build.json --outDir ./src/\_esm && printf
'{\"type\": \"module\",\"sideEffects\":false}' > ./src/\_esm/package.json", "build:trustedSetups:start": "mv
src/node/trustedSetups.ts src/node/trustedSetups_esm.ts && mv src/node/trustedSetups_cjs.ts src/node/trustedSetups.ts",
"build:trustedSetups:end": "mv src/node/trustedSetups.ts src/node/trustedSetups_cjs.ts && mv
src/node/trustedSetups_esm.ts src/node/trustedSetups.ts", "build:types": "tsc --project ./tsconfig.build.json
--declarationDir ./src/\_types --emitDeclarationOnly --declaration --declarationMap", "changeset:prepublish": "pnpm
version:update && pnpm build && bun scripts/prepublishOnly.ts",

    "build": "npm run build-esm && npm run build-commonjs",
    "build-esm": "tsc --project tsconfig.esm.json && mv ./lib.esm/index.js ./lib.esm/index.mjs",
    "build-commonjs": "tsc --project tsconfig.commonjs.json && mv ./lib.commonjs/index.js ./lib.commonjs/index.cjs",
    "clean": "rm -rf lib.esm lib.commonjs build && cp -r misc/basedirs/* .",
    "lint:ts": "eslint --ext .js,.ts ."
