import fhevmPlugin from '@fhevm/hardhat-plugin-v3';
import hardhatToolboxViemPlugin from '@nomicfoundation/hardhat-toolbox-viem';
import { defineConfig } from 'hardhat/config';

export default defineConfig({
  // The FHEVM plugin must be in this list. Importing it is not enough.
  plugins: [hardhatToolboxViemPlugin, fhevmPlugin],
  solidity: {
    // @fhevm/solidity needs solc 0.8.24 or later.
    version: '0.8.27',
    settings: { evmVersion: 'cancun' },
  },
  networks: {
    // Used only with `npx hardhat node`. The chain id must stay 31337.
    localhost: {
      type: 'http',
      chainType: 'l1',
      chainId: 31337,
      url: 'http://127.0.0.1:8545',
    },
  },
});
