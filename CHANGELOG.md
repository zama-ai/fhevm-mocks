# Changelog

## 0.13.0-0 — prerelease (npm `alpha` tag)

A full rewrite of the FHEVM mock stack. The three published packages now share one version, whose **minor number is the
protocol generation**: pin with a caret (`^0.13.0`) to stay on this generation.

Install prereleases by exact version — they are not on the `latest` tag.

### `@fhevm/host-contracts-cleartext@0.13.0-0` — new package, generation v13

- The full host address set, at the same addresses and behind the same interfaces as the production stack: `ACL`,
  `FHEVMExecutor`, `KMSVerifier`, `InputVerifier`, `HCULimit`, `ProtocolConfig`, `KMSGeneration`. The first four are
  cleartext replacements (`CleartextACL`, `CleartextFHEVMExecutor`, `CleartextKMSVerifier`, `CleartextInputVerifier`);
  the rest are the unmodified host contracts.
- Two cleartext-only contracts behind them: `CleartextArithmetic`, which computes the FHE operations on plaintext
  values, and `CleartextDB`, the shared store the results live in.
- Ships generated ABIs, TypeScript deploy/upgrade/address helpers (ESM + CJS), Solidity templates for the Hardhat
  plugins, and Foundry support files.
- Replaces the runtime mocking of `@fhevm/host-contracts` that the old plugin did through `@fhevm/mock-utils`.

### `@fhevm/hardhat-plugin@0.13.0-0` — Hardhat 2 (was `0.4.2`)

- Rebuilt on top of `@fhevm/host-contracts-cleartext` and `@fhevm/sdk`.
- Peer dependencies dropped: `@fhevm/mock-utils`, `@zama-fhe/relayer-sdk`, `encrypted-types`, `@fhevm/solidity`. Now
  peers on `@fhevm/sdk`, `@nomicfoundation/hardhat-ethers`, `ethers` and `hardhat@^2`.
- The `hre.fhevm` API (`createEncryptedInput`, `userDecryptEuint`, `assertCoprocessorInitialized`, …) is unchanged.
- Version jumps `0.4.x` → `0.13.x` to track the protocol generation; it is not 9 minors' worth of features.

### `@fhevm/hardhat-plugin-v3@0.13.0-0` — new package, Hardhat 3

- Brand-new plugin for Hardhat 3, peering on `hardhat@^3`, `viem` and `@fhevm/sdk`.
- The FHEVM API lives on the network connection, not on `hre`: `const { fhevm } = await network.connect();`.
- Surface: `fhevm.helpers` (`encrypt*`, `decrypt*`, `decryptPublic*`), `fhevm.cleartextDb` for ACL-bypassing reads in
  tests, and `fhevm.client` for the raw `@fhevm/sdk` client.

### Breaking

- Every package requires the `0.13` generation of the others; mixing with `0.12`/`0.4.x` artifacts is not supported.
- `@fhevm/mock-utils` is gone — the cleartext behaviour now lives in the on-chain contracts.

### Npmjs

- https://www.npmjs.com/package/@fhevm/hardhat-plugin/v/0.13.0-0
- https://www.npmjs.com/package/@fhevm/hardhat-plugin-v3/v/0.13.0-0
- https://www.npmjs.com/package/@fhevm/host-contracts-cleartext/v/0.13.0-0
