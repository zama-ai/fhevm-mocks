import setupDebug from "debug";
import * as fs from "fs";
import * as path from "path";
import * as picocolors from "picocolors";

import { HardhatFhevmError } from "../../error";
import type { FHEVMConfig } from "../../types";
import { FhevmEnvironmentPaths } from "../FhevmEnvironmentPaths";
import { assertHHFhevm } from "../error";

const debug = setupDebug("@fhevm/hardhat:addresses");

/**
 * This function parses `/path/to/user-package/node_modules/@fhevm/solidity/config/FHEVMConfig.sol` file
 * and replaces the addresses listed by the addresses used in the current mock FHEVM environment.
 * @returns The absolute path to the generated `FHEVMConfig.sol`
 */
export function generateFHEVMConfigDotSol(paths: FhevmEnvironmentPaths, addresses: FHEVMConfig): string {
  const dstPath = paths.cacheFHEVMConfigSol;

  if (fs.existsSync(dstPath)) {
    debug(`Skip ${picocolors.yellowBright("FHEVMConfig.sol")} generation. File ${dstPath} already exists.`);
    return dstPath;
  }

  const dstDir = path.dirname(dstPath);
  const origPath = path.join(paths.fhevmSolidityConfig, "FHEVMConfig.sol");

  if (!fs.existsSync(origPath)) {
    throw new HardhatFhevmError(
      `Unable to retrieve ${origPath}, make sure the package '@fhevm/solidity' is properly installed'`,
    );
  }

  const origContent: string = fs.readFileSync(origPath, "utf8");
  assertHHFhevm(origContent.indexOf("../lib/FHE.sol") >= 0);
  assertHHFhevm(origContent.indexOf("../lib/Impl.sol") >= 0);
  assertHHFhevm(origContent.indexOf("ACLAddress: 0xFee8407e2f5e3Ee68ad77cAE98c434e637f516e5") >= 0);
  assertHHFhevm(origContent.indexOf("FHEVMExecutorAddress: 0x687408aB54661ba0b4aeF3a44156c616c6955E07") >= 0);
  assertHHFhevm(origContent.indexOf("KMSVerifierAddress: 0x9D6891A6240D6130c54ae243d8005063D05fE14b") >= 0);
  assertHHFhevm(origContent.indexOf("InputVerifierAddress: 0x3a2DA6f1daE9eF988B48d9CF27523FA31a8eBE50") >= 0);

  const dstContent = origContent
    .replaceAll("../lib/FHE.sol", "@fhevm/solidity/lib/FHE.sol")
    .replaceAll("../lib/Impl.sol", "@fhevm/solidity/lib/Impl.sol")
    .replaceAll("0xFee8407e2f5e3Ee68ad77cAE98c434e637f516e5", addresses.ACLAddress)
    .replaceAll("0x687408aB54661ba0b4aeF3a44156c616c6955E07", addresses.FHEVMExecutorAddress)
    .replaceAll("0x9D6891A6240D6130c54ae243d8005063D05fE14b", addresses.KMSVerifierAddress)
    .replaceAll("0x3a2DA6f1daE9eF988B48d9CF27523FA31a8eBE50", addresses.InputVerifierAddress);

  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  fs.writeFileSync(dstPath, dstContent, "utf8");

  debug(`Generate ${picocolors.yellowBright("FHEVMConfig.sol")} at ${dstPath}. Source ${origPath}`);

  return dstPath;
}
