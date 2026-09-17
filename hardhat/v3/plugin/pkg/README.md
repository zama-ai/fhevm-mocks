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

> **Version `0.13.0-0` — beta prerelease.** This is a prerelease: it is not published under the `latest` npm tag, so
> install it by its exact version (`@fhevm/hardhat-plugin-v3@0.13.0-0`). APIs may still change before `0.13.0`.

For documentation and resources:

- [Setting up Hardhat](https://docs.zama.ai/protocol/solidity-guides/getting-started/setup)
- [FHEVM Examples](https://docs.zama.ai/protocol/examples)
- [Hardhat 3 example project](https://github.com/zama-ai/fhevm-mocks/tree/release/0.13.x/hardhat/v3/fhevm-hardhat-template/pkg): not a ready-to-use template, but a working project folder you can use as a model for your own setup

## List of peer dependencies

This Hardhat plugin relies on the following peer dependencies to function correctly.

- `@fhevm/sdk`
- `hardhat`
- `viem`

If your package manager does not install peer dependencies automatically (pnpm or npm <7), add them to your package
manually.

## Installation

```sh
npm install --save-dev @fhevm/hardhat-plugin-v3@0.13.0-0
```

And register the plugin in your [`hardhat.config.ts`](https://hardhat.org/config/):

```ts
import fhevmPlugin from '@fhevm/hardhat-plugin-v3';
import { defineConfig } from 'hardhat/config';

export default defineConfig({
  plugins: [fhevmPlugin],
});
```

# 🚀 Quick Start: Hello World with FHEVM

A minimal project: a contract that stores two encrypted values, adds them, and a test that decrypts the sum.

### 1. Install

```sh
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox-mocha-ethers @fhevm/hardhat-plugin-v3@0.13.0-0 @fhevm/sdk viem
npm install @fhevm/solidity
```

### 2. Create `contracts/APlusB.sol`

```solidity
// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint8, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract APlusB is ZamaEthereumConfig {
  euint8 private _a;
  euint8 private _b;
  euint8 private _aplusb;

  function setA(externalEuint8 inputA, bytes calldata inputProof) external {
    _a = FHE.fromExternal(inputA, inputProof);
    FHE.allowThis(_a);
  }

  function setB(externalEuint8 inputB, bytes calldata inputProof) external {
    _b = FHE.fromExternal(inputB, inputProof);
    FHE.allowThis(_b);
  }

  function computeAPlusB() external {
    _aplusb = FHE.add(_a, _b);
    FHE.allowThis(_aplusb);
    FHE.allow(_aplusb, msg.sender);
  }

  function aplusb() public view returns (euint8) {
    return _aplusb;
  }
}
```

### 3. Create `hardhat.config.ts`

See the [Hardhat 3 configuration guide](https://hardhat.org/docs/reference/configuration) for the full reference.

```ts
import fhevmPlugin from '@fhevm/hardhat-plugin-v3';
import hardhatToolboxMochaEthers from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import { defineConfig } from 'hardhat/config';

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers, fhevmPlugin],
  solidity: {
    version: '0.8.27',
    // ⚠️ FHEVM requires at least the "cancun" EVM version
    settings: { evmVersion: 'cancun' },
  },
});
```

### 4. Create `test/APlusB.ts`

In Hardhat 3 the FHEVM API lives on the network connection, not on `hre`.

```ts
import { expect } from 'chai';
import { network } from 'hardhat';

const { ethers, fhevm } = await network.connect();

describe('APlusB', function () {
  it('uint8: add 80 to 123 should equal 203', async function () {
    const [alice] = await ethers.getSigners();
    const contract = await ethers.deployContract('APlusB');
    const contractAddress = await contract.getAddress();

    // 1. Encrypt and store `a`
    const a = await fhevm.helpers.encryptUint8({ value: 80, contractAddress, userAddress: alice.address });
    await (await contract.setA(a.externalEuint8, a.inputProof)).wait();

    // 2. Encrypt and store `b`
    const b = await fhevm.helpers.encryptUint8({ value: 123, contractAddress, userAddress: alice.address });
    await (await contract.setB(b.externalEuint8, b.inputProof)).wait();

    // 3. Compute the FHE sum on chain
    await (await contract.computeAPlusB()).wait();

    // 4. Decrypt the result as alice
    const clear = await fhevm.helpers.decryptUint8({
      euint8: await contract.aplusb(),
      contractAddress,
      userAddress: alice.address,
    });

    expect(clear).to.eq(203n);
  });
});
```

### 5. Run

```sh
npx hardhat test
```

# 🧰 Plugin API cheat sheet

All helpers live on the connection's `fhevm` object: `const { fhevm } = await network.connect();`

### `fhevm.helpers` — encrypt

Each takes `{ value, contractAddress, userAddress }` and returns `{ external<Type>, inputProof }`.

| Function | `value` |
| --- | --- |
| `encryptBool` | `boolean` |
| `encryptUint8` | `number \| bigint` |
| `encryptUint16` | `number \| bigint` |
| `encryptUint32` | `number \| bigint` |
| `encryptUint64` | `number \| bigint` |
| `encryptUint128` | `number \| bigint` |
| `encryptUint256` | `number \| bigint` |
| `encryptAddress` | `string` |

### `fhevm.helpers` — decrypt (user decryption, requires an ACL allow + a permit)

Each takes `{ <handle>, contractAddress, userAddress, options? }`.

| Function | Handle arg | Returns |
| --- | --- | --- |
| `decryptBool` | `ebool` | `boolean` |
| `decryptUint8` | `euint8` | `number` |
| `decryptUint16` | `euint16` | `number` |
| `decryptUint32` | `euint32` | `number` |
| `decryptUint64` | `euint64` | `bigint` |
| `decryptUint128` | `euint128` | `bigint` |
| `decryptUint256` | `euint256` | `bigint` |
| `decryptAddress` | `eaddress` | `` `0x${string}` `` |

### `fhevm.helpers` — decryptPublic (requires `FHE.makePubliclyDecryptable`)

Each takes `{ <handle> }` only.

| Function | Handle arg | Returns |
| --- | --- | --- |
| `decryptPublicBool` | `ebool` | `boolean` |
| `decryptPublicUint8` | `euint8` | `number` |
| `decryptPublicUint16` | `euint16` | `number` |
| `decryptPublicUint32` | `euint32` | `number` |
| `decryptPublicUint64` | `euint64` | `bigint` |
| `decryptPublicUint128` | `euint128` | `bigint` |
| `decryptPublicUint256` | `euint256` | `bigint` |
| `decryptPublicAddress` | `eaddress` | `` `0x${string}` `` |

Every `decryptPublic*` has a `decryptPublic*WithSignatures` twin returning `{ clearValue, checkSignaturesArgs }`, for
testing on-chain signature verification.

### `fhevm.cleartextDb` — read cleartexts directly (tests only, bypasses the ACL)

Each takes `{ <handle> }` only and answers even when nobody is allowed to see the value.

| Function | Handle arg | Returns |
| --- | --- | --- |
| `readBool` | `ebool` | `boolean` |
| `readUint8` | `euint8` | `number` |
| `readUint16` | `euint16` | `number` |
| `readUint32` | `euint32` | `number` |
| `readUint64` | `euint64` | `bigint` |
| `readUint128` | `euint128` | `bigint` |
| `readUint256` | `euint256` | `bigint` |
| `readAddress` | `eaddress` | `` `0x${string}` `` |

### `fhevm.client` — the raw `@fhevm/sdk` client

The helpers above are convenience wrappers. When you need something they do not cover — or when you want to test the
`@fhevm/sdk` API itself — reach for `fhevm.client`, the underlying `FhevmClient` from `@fhevm/sdk`, and call its actions
directly.

```ts
const { fhevm } = await network.connect();
const { encryptedValues, inputProof } = await fhevm.client.encryptValues({
  values: [{ type: 'euint8', value: 80 }],
  contractAddress,
  userAddress,
});
```

# 📘 FHEVM Documentation and Examples

For more FHEVM examples and detailed documentation please go [here](https://docs.zama.ai/protocol)
