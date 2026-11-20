---
name: fhevm-hardhat3-setup
description: Set up a new FHEVM + Hardhat 3 development environment from an empty directory, for a user who does not know FHEVM, and diagnose setup-time failures. Use when the user asks to create, install, bootstrap, or scaffold an FHEVM Hardhat 3 project, or when a new FHEVM Hardhat 3 project fails to install, compile, or run its first test.
---

# Set up an FHEVM + Hardhat 3 environment

The goal is a project where `npx hardhat test` passes one FHEVM test. This skill covers setup only. It does not teach
how to write FHEVM contracts. When the setup is done, send the user to <https://docs.zama.ai/protocol>.

Assume that the user does not know FHEVM. Explain each step in one or two plain sentences before you run it.

## What to tell the user first

Give this explanation, in your own words, before you install anything:

- FHEVM lets a Solidity contract compute on encrypted values. The contract adds, compares, or stores numbers that it
  cannot read.
- On a real network, a separate system does the encrypted computation. That system is too heavy for a laptop.
- For development, a **cleartext** copy of the FHEVM contracts replaces it. The contracts have the same interfaces and
  the same addresses as the real ones, but they compute on plain values. Tests run fast, and no key material is needed.
- A contract that works against the cleartext copy uses the same Solidity code on a real FHEVM network.

## The packages

| Package                                 | Role                                                                                              | Installed by |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------ |
| `hardhat`                               | The build and test tool. Version 3.                                                               | You          |
| `@nomicfoundation/hardhat-toolbox-viem` | The standard Hardhat 3 plugin set: viem, the `node:test` runner, Ignition.                        | You          |
| `@fhevm/hardhat-plugin-v3`              | The FHEVM plugin. It deploys the cleartext contracts on each local chain and adds `fhevm` to it.  | You          |
| `@fhevm/sdk`                            | The client library that encrypts inputs and decrypts results. The plugin uses the project's copy. | You          |
| `viem`                                  | The Ethereum client library.                                                                      | You          |
| `@fhevm/solidity`                       | The Solidity library that contracts import: `FHE.sol` and `ZamaConfig.sol`.                       | You          |
| `@fhevm/host-contracts-cleartext`       | The cleartext FHEVM contracts, with their ABIs and deploy code.                                   | The plugin   |

Do not install `@fhevm/host-contracts-cleartext` directly. It is a dependency of the plugin, and the plugin selects the
version that it needs.

### The version rule

The minor number of `@fhevm/hardhat-plugin-v3` is the FHEVM protocol generation: `0.13.x` is generation 13, `0.14.x` is
generation 14. `@fhevm/sdk` must be in the range that the plugin declares in its `peerDependencies`. Never write an
`@fhevm/sdk` version from memory. Read the range from the registry:

```sh
npm view @fhevm/hardhat-plugin-v3 version peerDependencies
```

Do not use the `latest` tag of `@fhevm/sdk` as a guide. That tag can point to a version outside the plugin's range.

`@fhevm/solidity` has its own version numbers. Its minor number does not need to equal the plugin's minor number.

## Procedure

Run each step, and confirm its result before the next step. If a step fails, find the message in
[Setup problems](#setup-problems).

### 1. Check the tools

```sh
node --version
npm --version
```

- Node.js must be `22.23.4` or later. Hardhat 3 and the plugin do not run on Node.js 20.
- npm must be `7` or later, so that npm installs peer dependencies. Node.js 22 includes npm 10.

If `node` is not found, look for a version manager (`nvm`, `fnm`, `volta`, `mise`) before you ask the user to install
Node.js. A non-interactive shell often does not load the version manager.

### 2. Create the project

Use an empty directory. Ask the user for the name if they did not give one.

```sh
mkdir my-fhevm-project && cd my-fhevm-project
npm init -y
npm pkg set type=module
```

Hardhat 3 accepts only ESM projects, so `"type": "module"` is mandatory.

Do not run `npx hardhat --init`. It is interactive, and it creates example files that this setup does not use.

### 3. Install the packages

Install the development packages in **one** command. npm then selects an `@fhevm/sdk` version that the plugin accepts.

```sh
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox-viem @fhevm/hardhat-plugin-v3 @fhevm/sdk viem typescript @types/node@22
npm install @fhevm/solidity
```

Then confirm that the versions agree:

```sh
npm ls @fhevm/sdk @fhevm/hardhat-plugin-v3 @fhevm/host-contracts-cleartext @fhevm/solidity
```

The output must contain no `invalid` and no `UNMET` line. `npm audit` warnings from transitive dependencies do not block
the setup. Do not run `npm audit fix --force`: it can change the versions that this step selected.

### 4. Add the project files

Copy the files from the `files/` directory next to this `SKILL.md` into the project. Do not retype them.

| Source                            | Destination in the project  |
| --------------------------------- | --------------------------- |
| `files/hardhat.config.ts`         | `hardhat.config.ts`         |
| `files/tsconfig.json`             | `tsconfig.json`             |
| `files/gitignore`                 | `.gitignore`                |
| `files/contracts/FHECounter.sol`  | `contracts/FHECounter.sol`  |
| `files/test/FHECounter.ts`        | `test/FHECounter.ts`        |

`FHECounter` is a smoke test for the environment. Tell the user that they can delete it after the setup.

### 5. Compile

```sh
npx hardhat build
```

Expected output: `Compiled 1 Solidity file with solc 0.8.27 (evm target: cancun)`.

The first build downloads the Solidity compiler, so it needs network access.

### 6. Run the test

```sh
npx hardhat test
```

Expected output: `1 passing`. The test encrypts a value, adds it on chain, and decrypts the result. A pass proves that
the compiler, the plugin, the cleartext contracts, and the SDK work together.

No node needs to be started for this step. Hardhat creates a chain in the test process, and the plugin deploys the
cleartext contracts on it.

### 7. Optional: check the standalone node

Do this step only if the user wants a long-running local chain, for example for a frontend.

```sh
# Terminal 1
npx hardhat node

# Terminal 2
npx hardhat test --network localhost
```

The node prints a line that starts with `fhevm: cleartext FHEVM stack on 'node' (chainId 31337)`. That line confirms
that the plugin deployed the cleartext contracts. Stop the node when the check is done. Stop only the process that you
started.

### 8. Report

Tell the user:

- the installed versions of the plugin, the SDK, and `@fhevm/solidity`;
- the commands for daily use: `npx hardhat build` and `npx hardhat test`;
- that the plugin works on local development chains (in-process, `hardhat node`, anvil), and that a public network
  needs more configuration, which this skill does not cover;
- where to learn FHEVM: <https://docs.zama.ai/protocol>.

## Setup problems

Each entry gives the symptom, the cause, and the fix. The quoted messages are the real ones.

### Installation

| Symptom                                                                                         | Cause                                                                                                                     | Fix                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm warn EBADENGINE` that names `@fhevm/hardhat-plugin-v3` or `hardhat`                        | Node.js is older than `22.23.4`. npm only warns; the failure comes later.                                                 | Install Node.js 22.23.4 or later, delete `node_modules`, and install again.                                                      |
| `npm warn ERESOLVE overriding peer dependency` that names `@fhevm/sdk`                          | An `@fhevm/sdk` version outside the plugin's range was requested. npm installs it anyway.                                 | Read the range with `npm view @fhevm/hardhat-plugin-v3 peerDependencies`, then run `npm install --save-dev @fhevm/sdk@"<range>"`. |
| `npm ls` shows `@fhevm/sdk@… invalid`                                                           | Same cause as the line above.                                                                                             | Same fix.                                                                                                                        |
| `npm error 404` or `ETARGET` for an `@fhevm/…` version                                          | The requested generation is not published yet.                                                                            | List what exists with `npm view @fhevm/hardhat-plugin-v3 versions`, and install a published version.                             |
| The toolbox's packages (`hardhat-viem`, `hardhat-ignition`, …) are missing after the install    | The package manager did not install peer dependencies (npm 6, or pnpm with `auto-install-peers=false`).                   | Use npm 7 or later. Otherwise install each peer that `npm view @nomicfoundation/hardhat-toolbox-viem peerDependencies` lists.    |

### Configuration and compilation

| Symptom                                                                                      | Cause                                                                              | Fix                                                                                         |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Hardhat only supports ESM projects.`                                                        | `package.json` has no `"type": "module"`.                                          | `npm pkg set type=module`                                                                   |
| `Error HHE902: … The package "@fhevm/solidity" is not installed.`                            | The Solidity library is missing. The plugin does not install it.                   | `npm install @fhevm/solidity`                                                               |
| `Error HHE909: … No solc version enabled in this profile is compatible with this file.`      | The configured compiler is older than `0.8.24`, which `@fhevm/solidity` requires.  | Set `solidity.version` to `0.8.27` in `hardhat.config.ts`.                                  |
| The build stops while it downloads `solc`                                                    | No network access, or a proxy blocks the compiler download.                        | Give network access for the first build. Later builds use the cached compiler.              |
| `This is not the tsc command you are looking for`                                            | `typescript` is not installed in the project.                                      | `npm install --save-dev typescript`                                                         |

Keep `evmVersion: 'cancun'`. The plugin's documentation requires `cancun` or later.

### First test run

| Symptom                                                                                                       | Cause                                                                                                                       | Fix                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `TypeError: Cannot read properties of undefined (reading 'helpers')`                                          | `fhevm` is `undefined`: the plugin is imported, but it is not in the `plugins` array of `hardhat.config.ts`.                | Add `fhevmPlugin` to `plugins`.                                                                                      |
| `The contract function "userDecryptV1" reverted` … `Transaction reverted without a reason string`             | `@fhevm/sdk` and the plugin are from different generations. Encryption can pass, and decryption then fails.                 | Run `npm ls @fhevm/sdk`. If it shows `invalid`, install the SDK in the plugin's range (see Installation).            |
| `Unable to resolve '@fhevm/sdk' from the project at …` or the same message for `@fhevm/solidity`              | The package is not installed in the project root. The plugin resolves both from the project, never from its own directory.  | Install the package in the project that holds `hardhat.config.ts`.                                                   |
| `hre.fhevm` is `undefined`, or an example from a Hardhat 2 guide does not compile                             | Hardhat 3 has no `hre.fhevm`. The FHEVM API is on the network connection.                                                   | Use `const { fhevm } = await network.create()` (or `network.connect()`), as `test/FHECounter.ts` does.               |

### Standalone node

| Symptom                                                                                      | Cause                                                                                                   | Fix                                                                                                         |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `HardhatError: HHE703: Cannot connect to the network "localhost".`                           | No node listens on the configured URL.                                                                  | Start `npx hardhat node` in another terminal, or run the test without `--network localhost`.                |
| `Error: listen EADDRINUSE: address already in use 127.0.0.1:8545`                            | Another node already uses port 8545.                                                                    | Use the node that runs, or start a new one with `npx hardhat node --port <port>` and set the same port in the `localhost` URL. |
| `Network 'localhost' is configured with chainId …, but the node reports …`                   | The `chainId` in the config is not the chain id of the node.                                            | Set `chainId: 31337`, and start the node with its default chain id.                                         |
| `fhevm` is present, but no cleartext contracts exist on the local node                       | The node's chain id is not `31337`. The plugin deploys the cleartext contracts only on chain id 31337. | Start the node with chain id `31337`.                                                                       |

### If the problem is not in the tables

1. Run the failing command again with `--show-stack-traces`.
2. Run `npm ls @fhevm/sdk @fhevm/hardhat-plugin-v3 @fhevm/host-contracts-cleartext @fhevm/solidity hardhat viem`, and
   look for `invalid`, `UNMET`, or two copies of the same package.
3. Delete `node_modules`, `artifacts`, and `cache`, then repeat the procedure from step 3. Ask the user before you
   delete `package-lock.json`.
4. Report the exact message to the user. Do not guess a fix.
