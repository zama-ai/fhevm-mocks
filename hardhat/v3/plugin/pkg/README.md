<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/zama-ai/fhevm/main/docs/.gitbook/assets/fhevm-header-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/zama-ai/fhevm/main/docs/.gitbook/assets/fhevm-header-light.png">
  <img src="https://raw.githubusercontent.com/zama-ai/fhevm/main/docs/.gitbook/assets/fhevm-header-light.png" width="600" alt="FHEVM">
</picture>
</p>

<hr/>

<p align="center">
  <a href="https://github.com/zama-ai/fhevm/blob/main/fhevm-whitepaper.pdf">📃 Read white paper</a> | <a href="https://docs.zama.ai/"> 📒 Documentation</a> | <a href="https://zama.ai/community"> 💛 Community support</a> | <a href="https://github.com/zama-ai/awesome-zama"> 📚 FHE resources by Zama</a>
</p>

# FHEVM Hardhat 3 Plugin

[![NPM Version](https://img.shields.io/npm/v/%40fhevm%2Fhardhat-plugin-v3)](https://www.npmjs.com/package/@fhevm/hardhat-plugin-v3)
[![hardhat](https://hardhat.org/buidler-plugin-badge.svg?1)](https://hardhat.org)

Hardhat 3 plugin for developing and testing FHEVM contracts.

For documentation and resources:

- [Setting up Hardhat](https://docs.zama.ai/protocol/solidity-guides/getting-started/setup)
- [FHEVM Hardhat Plugin Development Guide](https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat)
- [FHEVM Examples](https://docs.zama.ai/protocol/examples)
- [Hardhat 3 template](https://github.com/zama-ai/fhevm-mocks/tree/release/0.13.x/hardhat/v3/fhevm-hardhat-template/pkg): a working example project using this plugin

## List of peer dependencies

This Hardhat plugin relies on the following peer dependencies to function correctly.

- `@fhevm/sdk`
- `hardhat`
- `viem`

If your package manager does not install peer dependencies automatically (pnpm or npm <7), add them to your package
manually.

## Installation

```sh
npm install --save-dev @fhevm/hardhat-plugin-v3
```

And register the plugin in your [`hardhat.config.ts`](https://hardhat.org/config/):

```ts
import fhevmPlugin from '@fhevm/hardhat-plugin-v3';
import { defineConfig } from 'hardhat/config';

export default defineConfig({
  plugins: [fhevmPlugin],
});
```

## Usage

Hardhat 3 scopes networks to connections, so the FHEVM API lives on the connection:

```ts
import { network } from 'hardhat';

const { fhevm } = await network.connect();
```

# 📘 FHEVM Documentation and Examples

For more FHEVM examples and detailed documentation please go [here](https://docs.zama.ai/protocol)
