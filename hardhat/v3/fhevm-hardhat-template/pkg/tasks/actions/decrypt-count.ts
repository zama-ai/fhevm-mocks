import type { NewTaskActionFunction } from 'hardhat/types/tasks';

import { firstWallet, parseAddress } from './helpers.js';

type Args = { address: string };

const decryptCount: NewTaskActionFunction<Args> = async ({ address }, hre) => {
  const contractAddress = parseAddress(address);
  const connection = await hre.network.create();
  const wallet = await firstWallet(connection);
  const counter = await connection.viem.getContractAt('FHECounter', contractAddress);
  const encryptedCount = await counter.read.getCount();

  if (BigInt(encryptedCount) === 0n) {
    console.log('Clear count: 0');
    return 0;
  }

  const clearCount = await connection.fhevm.helpers.decryptUint32({
    euint32: encryptedCount,
    contractAddress,
    userAddress: wallet.account.address,
  });
  console.log(`Clear count: ${String(clearCount)}`);
  return clearCount;
};

export default decryptCount;
