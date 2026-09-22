import '@fhevm/hardhat-plugin';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomicfoundation/hardhat-ethers';
import '@typechain/hardhat';
import type { HardhatUserConfig } from 'hardhat/config';
import { vars } from 'hardhat/config';

// About chai
// ----------
// import @nomicfoundation/hardhat-chai-matchers
// is needed to use 'revertedWithCustomError' in tests

// Run 'npx hardhat vars setup' to see the list of variables that need to be set

const MNEMONIC: string = vars.get('MNEMONIC', 'test test test test test test test test test test test junk');

// anvil funds the accounts of ITS OWN default mnemonic and no others, so the `anvil` network below is
// pinned to it rather than following the operator's MNEMONIC var. With the var set — which it is on any
// machine that has run against a real testnet — deriving from it hands the suite ten unfunded addresses
// and every deploy fails with "insufficient funds", locally only, while CI stays green on the fallback.
// The in-process `hardhat` network is different: it funds whatever mnemonic it is given, so it may
// follow the var. This is the same constant v3's e2e config spells out for the same reason.
const ANVIL_MNEMONIC = 'test test test test test test test test test test test junk';
const INFURA_API_KEY: string = vars.get('INFURA_API_KEY', 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz');

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC,
      },
      chainId: 31337,
    },
    anvil: {
      accounts: {
        mnemonic: ANVIL_MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 31337,
      url: 'http://localhost:8545',
    },
    sepolia: {
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 11155111,
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
    },
  },
  paths: {
    artifacts: './artifacts',
    cache: './cache',
    sources: './contracts',
    tests: './test',
  },
  solidity: {
    version: '0.8.27',
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: 'none',
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: 'cancun',
    },
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
