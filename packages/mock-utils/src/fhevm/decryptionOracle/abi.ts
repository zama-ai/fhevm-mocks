import { ethers as EthersT } from "ethers";

export const DecryptionOraclePartialInterface: EthersT.Interface = new EthersT.Interface([
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "counter",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "requestID",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bytes32[]",
        name: "cts",
        type: "bytes32[]",
      },
      {
        indexed: false,
        internalType: "address",
        name: "contractCaller",
        type: "address",
      },
      {
        indexed: false,
        internalType: "bytes4",
        name: "callbackSelector",
        type: "bytes4",
      },
    ],
    name: "DecryptionRequest",
    type: "event",
  },
]);
