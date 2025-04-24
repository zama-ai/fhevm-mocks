import { HardhatRuntimeEnvironment } from "hardhat/types";

export const mineNBlocks = async (hre: HardhatRuntimeEnvironment, n: number) => {
  for (let index = 0; index < n; index++) {
    await hre.ethers.provider.send("evm_mine");
  }
};

export const waitNBlocks = async (hre: HardhatRuntimeEnvironment, Nblocks: number) => {
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  if (hre.network.name === "hardhat") {
    await produceDummyTransactions(hre, Nblocks);
  } else {
    await waitForBlock(hre, BigInt(currentBlock + Nblocks));
  }
};

export const produceDummyTransactions = async (hre: HardhatRuntimeEnvironment, blockCount: number) => {
  let counter = blockCount;
  while (counter >= 0) {
    counter--;
    const [signer] = await hre.ethers.getSigners();
    const nullAddress = "0x0000000000000000000000000000000000000000";
    const tx = {
      to: nullAddress,
      value: 0n,
    };
    const receipt = await signer.sendTransaction(tx);
    await receipt.wait();
  }
};

const waitForBlock = (hre: HardhatRuntimeEnvironment, blockNumber: bigint) => {
  return new Promise((resolve, reject) => {
    const waitBlock = async (currentBlock: number) => {
      if (blockNumber <= BigInt(currentBlock)) {
        await hre.ethers.provider.off("block", waitBlock);
        resolve(blockNumber);
      }
    };
    hre.ethers.provider.on("block", waitBlock).catch((err) => {
      reject(err);
    });
  });
};
