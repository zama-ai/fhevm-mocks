import { ethers as EthersT } from "ethers";

import { FhevmError, assertFhevm } from "../../utils/error.js";
import { remove0x } from "../../utils/string.js";

// Follows relayer-sdk keys lengths
const ML_KEM_CT_PK_LENGTH: number = 1568;
const ML_KEM_SK_LENGTH: number = 3168;

const PUBLIC_KEY_LENGTH: number = (ML_KEM_CT_PK_LENGTH + 8) * 2;
const PRIVATE_KEY_LENGTH: number = (ML_KEM_SK_LENGTH + 8) * 2;

function _verifyKeypair(keyPair: { publicKey: string; privateKey: string }) {
  keyPair.publicKey = remove0x(keyPair.publicKey);
  keyPair.privateKey = remove0x(keyPair.privateKey);

  if (!EthersT.isHexString("0x" + keyPair.publicKey, PUBLIC_KEY_LENGTH)) {
    throw new FhevmError(
      `Invalid key pair's publicKey. Call FhevmInstance.generateKeyPair() to generate a valid FHEVM key pair.`,
    );
  }
  if (!EthersT.isHexString("0x" + keyPair.privateKey, PRIVATE_KEY_LENGTH)) {
    throw new FhevmError(
      `Invalid key pair's publicKey. Call FhevmInstance.generateKeyPair() to generate a valid FHEVM key pair.`,
    );
  }
}

export function generateKeypair(): {
  publicKey: string;
  privateKey: string;
} {
  const wallet = EthersT.Wallet.createRandom();

  const walletPublicKeyNoPrefix = remove0x(wallet.publicKey);
  const walletPrivateKeyNoPrefix = remove0x(wallet.privateKey);

  assertFhevm(walletPublicKeyNoPrefix.length === walletPrivateKeyNoPrefix.length + 2);

  const publicKeyPrefixLen = 2 * PUBLIC_KEY_LENGTH - walletPublicKeyNoPrefix.length;
  const privateKeyPrefixLen = 2 * PRIVATE_KEY_LENGTH - (2 + walletPrivateKeyNoPrefix.length);

  let n = Math.floor(publicKeyPrefixLen / 8);
  const publicKeyPrefix = "deadbeef".repeat(n) + "0".repeat(publicKeyPrefixLen - n * 8);

  n = Math.floor(privateKeyPrefixLen / 8);
  const privateKeyPrefix = "deadbeef".repeat(n) + "0".repeat(privateKeyPrefixLen - n * 8);

  const publicKey = "0x" + publicKeyPrefix + walletPublicKeyNoPrefix;
  const privateKey = "0x" + privateKeyPrefix + "00" + walletPrivateKeyNoPrefix;

  assertFhevm(publicKey.length === 2 + 2 * PUBLIC_KEY_LENGTH);
  assertFhevm(privateKey.length === 2 + 2 * PRIVATE_KEY_LENGTH);
  assertFhevm(walletPublicKeyNoPrefix.length === 66);
  assertFhevm(walletPrivateKeyNoPrefix.length === 64);

  const keypair = {
    publicKey,
    privateKey,
  };

  _verifyKeypair(keypair);

  return keypair;
}
