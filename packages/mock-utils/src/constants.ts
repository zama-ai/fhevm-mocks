const constants = {
  FHEVM_HANDLE_VERSION: 0,
  DEFAULT_DURATION_DAYS: 365,
  DECRYPTION_EIP712_DOMAIN: { version: "1", name: "Decryption" },
  PUBLIC_DECRYPT_EIP712_TYPE: {
    PublicDecryptVerification: [
      {
        name: "ctHandles",
        type: "bytes32[]",
      },
      {
        name: "decryptedResult",
        type: "bytes",
      },
    ],
  },
  INPUT_VERIFICATION_EIP712_DOMAIN: { version: "1", name: "InputVerification" },
  INPUT_VERIFICATION_EIP712_TYPE: {
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
    ],
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
  FHEVM_CORE_CONTRACTS_PACKAGE_NAME: "@fhevm/core-contracts",
  ZAMA_FHE_ORACLE_SOLIDITY_PACKAGE_NAME: "@zama-fhe/oracle-solidity",
};
Object.freeze(constants);

export default constants;
