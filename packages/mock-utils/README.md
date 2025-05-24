## Run

node ./lib.esm/index.js

(package.json need to resolve the type of module)

or

mv ./lib.esm/index.js ./lib.esm/index.mjs

node ./lib.esm/index.mjs

(no need of package.json)

idem for .js -> .cjs

## Publish dry-run

```
cd ./src
npm publish --dry-run
```
