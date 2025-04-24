import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/types";

// We load the plugin here.
import "./src/index";

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
  typechain: {
    target: "ethers-v6",
  },
};

export default config;
