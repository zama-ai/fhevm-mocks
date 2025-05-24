import { ethers as EthersT } from "ethers";

import { FhevmError } from "./error.js";
import { removePrefix } from "./string.js";

// import {
//     u8vec_to_cryptobox_pk,
//     u8vec_to_cryptobox_sk,
// } from 'node-tkms';

/*
    let pubKey;
    let privKey;
    try {
      pubKey = u8vec_to_cryptobox_pk(fromHexString(publicKey));
      privKey = u8vec_to_cryptobox_sk(fromHexString(privateKey));
    } catch (e) {
      throw new Error('Invalid public or private key', { cause: e });
    }
  */

export function verifyKeypair(keyPair: { publicKey: string; privateKey: string }) {
  keyPair.publicKey = removePrefix(keyPair.publicKey, "0x");
  keyPair.privateKey = removePrefix(keyPair.privateKey, "0x");

  if (!EthersT.isHexString("0x" + keyPair.publicKey, 80)) {
    throw new FhevmError(
      `Invalid key pair's publicKey. Call FhevmInstance.generateKeyPair() to generate a valid FHEVM key pair.`,
    );
  }
  if (!EthersT.isHexString("0x" + keyPair.privateKey, 80)) {
    throw new FhevmError(
      `Invalid key pair's publicKey. Call FhevmInstance.generateKeyPair() to generate a valid FHEVM key pair.`,
    );
  }
}
