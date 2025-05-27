## 🧾 Notes on `tsconfig` Structure (Dual Build: ESM + CommonJS)

To build a pure ESM lib. Do not specify "type" in package.json

View full esm config

```
npx tsc --showConfig -p tsconfig.esm.json
```

View full commmonjs config

```
npx tsc --showConfig -p tsconfig.cjs.json
```

View full VSCode config

```
npx tsc --showConfig -p tsconfig.json
```
