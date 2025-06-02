# FHEVM Hardhat Plugin

Hardhat plugin for developping and testing FHEVM contracts.

## List of peer dependencies

This Hardhat plugin relies on the following peer dependencies to function correctly.

- `@fhevm/mock-utils`
- `@fhevm/solidity`
- `@nomicfoundation/hardhat-ethers`
- `@nomicfoundation/hardhat-network-helpers`,
- `@zama-fhe/oracle-solidity`
- `@zama-fhe/relayer-sdk`
- `ethers`
- `hardhat`

### Automatic Installation (npm v7+)

If you're using npm version 7 or later, these peer dependencies will be automatically installed when you install this
plugin — no additional action is required.

### Manual peer dependencies installation

If you're using a package manager that does not automatically install peer dependencies (like pnpm or npm <7) then
you'll need to add them manually to your package.

## Installation

```sh
npm install --save-dev @fhevm/hardhat-plugin
```

And register the plugin in your [`hardhat.config.js`](https://hardhat.org/config/):

```ts
// Typescript
import "@fhevm/hardhat-plugin";
```
