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

<p align="center">
  <a href="https://github.com/zama-ai/fhevm-mocks/releases">
    <img src="https://img.shields.io/github/v/release/zama-ai/fhevm-mocks?style=flat-square"></a>
  <a href="https://github.com/zama-ai/fhevm-mocks/blob/main/LICENSE">
    <!-- markdown-link-check-disable-next-line -->
    <img src="https://img.shields.io/badge/License-BSD--3--Clause--Clear-%23ffb243?style=flat-square"></a>
  <a href="https://github.com/zama-ai/bounty-program">
    <!-- markdown-link-check-disable-next-line -->
    <img src="https://img.shields.io/badge/Contribute-Zama%20Bounty%20Program-%23ffd208?style=flat-square"></a>
  <a href="https://slsa.dev"><img alt="SLSA 3" src="https://slsa.dev/images/gh-badge-level3.svg" /></a>
</p>

## About

This repository contains all the necessary tools to develop and test FHEVM contracts in mock mode.

It is organized as a monorepo with two standalone packages:

- [packages/mock-utils](./packages/mock-utils): A set of utilities for mocking the FHEVM environment during local
  development and testing.

- [packages/hardhat-plugin](./packages/hardhat-plugin): A [Hardhat](https://hardhat.org) plugin that allows you to
  compile, deploy, and test FHEVM contracts seamlessly using the mock runtime.

These tools are designed to make it easy to build and verify FHE-based smart contracts without requiring access to a
real FHEVM network.

Please refer to each of these packages for detailed API documentation, user guides, and examples on how to use them and
incorporate them into your project.

### What is FHEVM?

For more information about FHEVM, the technology that enables confidential smart contracts on the EVM using fully
homomorphic encryption (FHE), please refer to the [FHEVM Official Documentation](https://docs.zama.ai/protocol)

### When should you use fhevm-mocks?

- When you want to run fast local tests in mocked mode without connecting to a real fhEVM network.
- When you need code coverage for confidential contracts before switching to a full end-to-end stack.

### License

This software is distributed under the **BSD-3-Clause-Clear** license. Read [this](LICENSE) for more details.

## Support

<a target="_blank" href="https://community.zama.ai">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/zama-ai/fhevm-solidity/assets/157474013/e249e1a8-d724-478c-afa8-e4fe01c1a0fd">
  <source media="(prefers-color-scheme: light)" srcset="https://github.com/zama-ai/fhevm-solidity/assets/157474013/a72200cc-d93e-44c7-81a8-557901d8798d">
  <a target="_blank" href="https://community.zama.ai">
  <img src="https://github.com/zama-ai/fhevm-solidity/assets/157474013/a72200cc-d93e-44c7-81a8-557901d8798d" alt="Support">
</a>
</picture>
</a>

🌟 If you find this project helpful or interesting, please consider giving it a star on GitHub! Your support helps to
grow the community and motivates further development.

<p align="right">
  <a href="#about" > ↑ Back to top </a>
</p>
