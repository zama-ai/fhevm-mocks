import { ethers as EthersT } from "ethers";

// version "0.8.0-0"
export const HCULimitInterfaceVersion = "0.8.0-0";

export const HCULimitPartialInterface: EthersT.Interface = new EthersT.Interface([
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "target",
        type: "address",
      },
    ],
    name: "AddressEmptyCode",
    type: "error",
  },
  {
    inputs: [],
    name: "CallerMustBeFHEVMExecutorContract",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "implementation",
        type: "address",
      },
    ],
    name: "ERC1967InvalidImplementation",
    type: "error",
  },
  {
    inputs: [],
    name: "ERC1967NonPayable",
    type: "error",
  },
  {
    inputs: [],
    name: "FailedCall",
    type: "error",
  },
  {
    inputs: [],
    name: "HCUTransactionDepthLimitExceeded",
    type: "error",
  },
  {
    inputs: [],
    name: "HCUTransactionLimitExceeded",
    type: "error",
  },
  {
    inputs: [],
    name: "InvalidInitialization",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
    ],
    name: "NotHostOwner",
    type: "error",
  },
  {
    inputs: [],
    name: "NotInitializing",
    type: "error",
  },
  {
    inputs: [],
    name: "NotInitializingFromEmptyProxy",
    type: "error",
  },
  {
    inputs: [],
    name: "OnlyScalarOperationsAreSupported",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
    ],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    inputs: [],
    name: "UUPSUnauthorizedCallContext",
    type: "error",
  },
  {
    inputs: [
      {
        internalType: "bytes32",
        name: "slot",
        type: "bytes32",
      },
    ],
    name: "UUPSUnsupportedProxiableUUID",
    type: "error",
  },
  {
    inputs: [],
    name: "UnsupportedOperation",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "uint64",
        name: "version",
        type: "uint64",
      },
    ],
    name: "Initialized",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferStarted",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "implementation",
        type: "address",
      },
    ],
    name: "Upgraded",
    type: "event",
  },
  {
    inputs: [],
    name: "UPGRADE_INTERFACE_VERSION",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "acceptOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes32",
        name: "ct",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForCast",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheAdd",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheBitAnd",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheBitOr",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheBitXor",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheDiv",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheEq",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheGe",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheGt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheLe",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheLt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheMax",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheMin",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheMul",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheNe",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes32",
        name: "ct",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheNeg",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes32",
        name: "ct",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheNot",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheRand",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheRandBounded",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheRem",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheRotl",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheRotr",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheShl",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheShr",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes1",
        name: "scalarByte",
        type: "bytes1",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForFheSub",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes32",
        name: "lhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "middle",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "rhs",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForIfThenElse",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "enum FheType",
        name: "resultType",
        type: "uint8",
      },
      {
        internalType: "bytes32",
        name: "result",
        type: "bytes32",
      },
    ],
    name: "checkHCUForTrivialEncrypt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getFHEVMExecutorAddress",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getVersion",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
  {
    inputs: [],
    name: "initializeFromEmptyProxy",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "pendingOwner",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "proxiableUUID",
    outputs: [
      {
        internalType: "bytes32",
        name: "",
        type: "bytes32",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "reinitializeV4",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "newImplementation",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "data",
        type: "bytes",
      },
    ],
    name: "upgradeToAndCall",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
]);
