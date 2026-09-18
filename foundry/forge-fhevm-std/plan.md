# Naming

Golden rule:
- follow forge-std naming practices
- Libraries should be named Lib<Name>.sol (see LibVariable.sol)
- abstract contracts should be named StdFhevm<Name>.sol (see forge-std naming)
- 



    /// Signs data with a `Wallet`.
    function sign(Wallet calldata wallet, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);

    /// Signs `digest` with `privateKey` using the secp256k1 curve.
    function sign(uint256 privateKey, bytes32 digest) external pure returns (uint8 v, bytes32 r, bytes32 s);

    /// Signs `digest` with signer provided to script using the secp256k1 curve.
    /// If `--sender` is provided, the signer with provided address is used, otherwise,
    /// if exactly one signer is provided to the script, that signer is used.
    /// Raises error if signer passed through `--sender` does not match any unlocked signers or
    /// if `--sender` is not provided and not exactly one signer is passed to the script.
    function sign(bytes32 digest) external pure returns (uint8 v, bytes32 r, bytes32 s);

    /// Signs `digest` with signer provided to script using the secp256k1 curve.
    /// Raises error if none of the signers passed into the script have provided address.
    function sign(address signer, bytes32 digest) external pure returns (uint8 v, bytes32 r, bytes32 s);
reanme /Users/alex/src/me/zama-ai/fhevm-mocks-v14/foundry/forge-fhevm-std/pkg/src/_host/FhevmCleartextDecrypt.sol
to V1 because of durationDays
move FheType lib to /Users/alex/src/me/zama-ai/fhevm-mocks-v14/foundry/forge-fhevm-std/pkg/src/_host
because FheType is more on host side
must be in FhevmCleartextDecrypt
    function generateTransportKeypair() internal returns (TransportKeypair memory keypair) {
        keypair.privateKey = _randomPrivateKey();
        keypair.publicKey = _getTransportPublicKey(keypair.privateKey);
    }
