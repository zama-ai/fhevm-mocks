const constants = {
  FHEVM_HANDLE_VERSION: 0,
  DEFAULT_DURATION_DAYS: 365,
  // https://github.com/zama-ai/fhevm/blob/main/gateway-contracts/contracts/Decryption.sol#L138
  PUBLIC_DECRYPT_EIP712: {
    domain: { version: "1", name: "Decryption" },
    types: {
      PublicDecryptVerification: [
        {
          name: "ctHandles",
          type: "bytes32[]",
        },
        {
          name: "decryptedResult",
          type: "bytes",
        },
        {
          name: "extraData",
          type: "bytes",
        },
      ],
    },
  },
  // https://github.com/zama-ai/fhevm/blob/main/gateway-contracts/contracts/InputVerification.sol#L66
  INPUT_VERIFICATION_EIP712: {
    domain: { version: "1", name: "InputVerification" },
    types: {
      CiphertextVerification: [
        {
          name: "ctHandles",
          type: "bytes32[]",
        },
        {
          name: "userAddress",
          type: "address",
        },
        {
          name: "contractAddress",
          type: "address",
        },
        {
          name: "contractChainId",
          type: "uint256",
        },
        {
          name: "extraData",
          type: "bytes",
        },
      ],
    },
  },
  TEST_MNEMONIC: "test test test test test test test future home encrypt virtual machine",
  DEFAULT_KMS_SIGNERS_ACCOUNTS: {
    initialIndex: 0,
    path: "m/44'/60'/1'/0",
  },
  DEFAULT_COPROCESSOR_SIGNERS_ACCOUNTS: {
    initialIndex: 0,
    path: "m/44'/60'/2'/0",
  },
  DEFAULT_RELAYER_SIGNERS_ACCOUNTS: {
    initialIndex: 0,
    path: "m/44'/60'/3'/0",
  },
  SEPOLIA_ETHEREUM_TESTNET_CHAINID: 11155111,
  FHEVM_HOST_CONTRACTS_PACKAGE_NAME: "@fhevm/host-contracts",
};
Object.freeze(constants);

export default constants;
