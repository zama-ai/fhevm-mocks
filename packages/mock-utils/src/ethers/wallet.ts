import { ethers as EthersT } from "ethers";

import constants from "../constants.js";
import { FhevmError } from "../utils/error.js";
import { toLowerCaseSet } from "../utils/string.js";

export function defaultWallets(
  initialIndex: number,
  count: number,
  path: string,
  mnemonic?: string,
  provider?: EthersT.Provider | null,
): EthersT.HDNodeWallet[] {
  const wallets: EthersT.HDNodeWallet[] = [];
  for (let i = 0; i < count; ++i) {
    wallets.push(walletFromMnemonic(i + initialIndex, mnemonic ?? constants.TEST_MNEMONIC, path, provider ?? null));
  }
  return wallets;
}

export function defaultWalletsAsMap(
  initialIndex: number,
  count: number,
  path: string,
  mnemonic?: string,
  provider?: EthersT.Provider | null,
): Map<string, EthersT.HDNodeWallet> {
  const wallets: Map<string, EthersT.HDNodeWallet> = new Map();
  for (let i = 0; i < count; ++i) {
    const w = walletFromMnemonic(i + initialIndex, mnemonic ?? constants.TEST_MNEMONIC, path, provider ?? null);
    wallets.set(w.address, w);
  }
  return wallets;
}

export function walletFromMnemonic(
  index: number,
  phrase: string,
  path: string,
  provider: EthersT.Provider | null,
): EthersT.HDNodeWallet {
  const mnemonic = EthersT.Mnemonic.fromPhrase(phrase);
  if (!mnemonic) {
    throw new FhevmError(`Invalid mnemonic phrase: ${phrase}`);
  }
  const rootWallet = EthersT.HDNodeWallet.fromMnemonic(mnemonic, path);
  return rootWallet.deriveChild(index).connect(provider);
}

export function walletsFromPrivateKeys(
  privateKeys: string[],
  addresses?: string[],
  provider?: EthersT.Provider,
): { wallets: EthersT.Wallet[]; ignoredPrivateKeys: string[] } {
  const wallets: EthersT.Wallet[] = [];
  const ignoredPrivateKeys: string[] = [];

  if (addresses !== undefined) {
    const s = toLowerCaseSet(addresses);

    for (let i = 0; i < privateKeys.length; ++i) {
      const pk = privateKeys[i]!;
      const w = new EthersT.Wallet(pk, provider ?? null);
      if (s.has(w.address.toLowerCase())) {
        wallets.push(w);
      } else {
        ignoredPrivateKeys.push(pk);
      }
    }
  }

  return { wallets, ignoredPrivateKeys };
}
