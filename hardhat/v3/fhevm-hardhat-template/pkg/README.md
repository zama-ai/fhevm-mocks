# FHEVM Hardhat 3 Template

A Hardhat 3 template for developing Fully Homomorphic Encryption (FHE) enabled Solidity smart contracts with Zama's
FHEVM protocol. It follows Hardhat's official ESM, `node:test`, Viem, and Ignition project profile and uses the
[`@fhevm/hardhat-plugin-v3`](https://github.com/zama-ai/fhevm-mocks/tree/release/0.13.x/hardhat/v3/plugin/pkg) plugin: the
FHEVM API lives on the network connection (`const { fhevm } = await network.connect()`).

> **Note**: this version of the plugin only supports development networks (in-process Hardhat network, `hardhat node`
> and anvil). Public FHEVM networks such as Sepolia will be supported in a later release: `deploy:sepolia` works, but
> `test:sepolia` and the `counter` tasks cannot target Sepolia yet.

## Quick Start

### Prerequisites

- **Node.js**: Version 22 or higher
- **npm or yarn/pnpm**: Package manager

### Installation

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Sepolia credentials when needed**

   ```bash
   npx hardhat keystore set SEPOLIA_RPC_URL
   npx hardhat keystore set SEPOLIA_PRIVATE_KEY
   ```

3. **Compile and test**

   ```bash
   npm run compile
   npm run test
   ```

4. **Deploy to local network**

   ```bash
   # Terminal 1: start a local FHEVM-ready node
   npm run chain

   # Terminal 2: deploy the example
   npm run deploy:localhost
   ```

5. **Interact with a deployed counter**

   ```bash
   npx hardhat --network localhost counter decrypt-count <CONTRACT_ADDRESS>
   npx hardhat --network localhost counter increment <CONTRACT_ADDRESS> 2
   npx hardhat --network localhost counter decrement <CONTRACT_ADDRESS> 1
   ```

6. **Deploy to Sepolia Testnet**

   ```bash
   npm run deploy:sepolia

   # Verify contract on Etherscan
   npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
   ```

## 📁 Project Structure

```
fhevm-hardhat-template/
├── contracts/           # Smart contract source files
│   └── FHECounter.sol   # Example FHE counter contract
├── ignition/modules/    # Declarative Ignition deployment modules
├── tasks/               # Hardhat custom tasks
├── test/                # Test files
├── hardhat.config.ts    # Hardhat configuration
└── package.json         # Dependencies and scripts
```

## 📜 Available Scripts

| Script                     | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `npm run compile`          | Compile contracts                               |
| `npm run test`             | Run local cleartext tests                       |
| `npm run test:coverage`    | Run tests with Hardhat 3 coverage               |
| `npm run test:sepolia`     | Run the public-network test (not yet supported) |
| `npm run chain`            | Start the local Hardhat 3 node                  |
| `npm run deploy:localhost` | Deploy to the local node                        |
| `npm run deploy:sepolia`   | Deploy to Sepolia                               |
| `npm run lint`             | Run ESLint and formatting checks                |
| `npm run clean`            | Remove generated artifacts and typings          |

## 📚 Documentation

- [FHEVM Documentation](https://docs.zama.ai/protocol)
- [FHEVM Hardhat Setup Guide](https://docs.zama.ai/protocol/solidity-guides/getting-started/setup)
- [FHEVM Testing Guide](https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat/write_test)
- [FHEVM Hardhat Plugin](https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat)

## 📄 License

This project is licensed under the BSD-3-Clause-Clear License. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/zama-ai/fhevm/issues)
- **Documentation**: [FHEVM Docs](https://docs.zama.ai)
- **Community**: [Zama Discord](https://discord.gg/zama)

---

**Built with ❤️ by the Zama team**
