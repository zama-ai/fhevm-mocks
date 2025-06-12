import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import { vars } from "hardhat/config";
import { HardhatUserConfig } from "hardhat/types";
import "solidity-coverage";

// We load the plugin here.
import "./src/index";

const MNEMONIC: string = vars.has("MNEMONIC")
  ? vars.get("MNEMONIC")
  : "test test test test test test test test test test test junk";
const INFURA_API_KEY: string = vars.has("INFURA_API_KEY")
  ? vars.get("INFURA_API_KEY")
  : "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    anvil: {
      url: "http://127.0.0.1:8545",
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10,
      },
    },
    sepolia: {
      accounts: {
        count: 10,
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0",
      },
      url: "https://sepolia.infura.io/v3/" + INFURA_API_KEY,
      chainId: 11155111,
    },
  },
  typechain: {
    target: "ethers-v6",
  },
};

export default config;
