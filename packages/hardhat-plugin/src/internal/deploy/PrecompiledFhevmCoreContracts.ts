import { exec } from "child_process";
import setupDebug from "debug";
import { ethers as EthersT } from "ethers";
import * as fs from "fs";
import * as picocolors from "picocolors";

import constants from "../../constants";
import { HardhatFhevmError } from "../../error";
import { SCOPE_FHEVM, SCOPE_FHEVM_TASK_INSTALL_SOLIDITY } from "../../task-names";
import { FhevmEnvironmentPaths } from "../FhevmEnvironmentPaths";
import { PrecompiledCoreContractsAddresses } from "../types";
import { FhevmEthersProvider } from "../utils/FhevmEthersProvider";
import { computeDummyAddress } from "../utils/hh";

const debug = setupDebug("@fhevm/hardhat:addresses");

function __logPrecompiledAddresses(addresses: PrecompiledCoreContractsAddresses, useCache: boolean) {
  const prefix = !useCache ? "Resolve" : `${picocolors.yellowBright("Cache")}`;
  debug(`${prefix} precompiled ${picocolors.cyanBright("ACL")} address                  : ${addresses.ACLAddress}`);
  debug(
    `${prefix} precompiled ${picocolors.cyanBright("FHEVMExecutor")} address        : ${addresses.FHEVMExecutorAddress}`,
  );
  debug(
    `${prefix} precompiled ${picocolors.cyanBright("InputVerifierAddress")} address : ${addresses.InputVerifierAddress}`,
  );
  debug(
    `${prefix} precompiled ${picocolors.cyanBright("FHEGasLimitAddress")} address   : ${addresses.FHEGasLimitAddress}`,
  );
}

async function childProcessExecNpxHardhatFhevmInstallSolidity(alreadyRunning: boolean) {
  const cmd = `npx hardhat ${SCOPE_FHEVM} ${SCOPE_FHEVM_TASK_INSTALL_SOLIDITY} --network hardhat`;

  if (alreadyRunning) {
    throw new HardhatFhevmError(`Command '${cmd}' is already running.`);
  }

  debug(`Running command '${cmd}' ...`);

  const output: string = await new Promise((resolve, reject) => {
    const process = exec(
      cmd,
      {
        maxBuffer: 1024 * 1024 * 500,
      },
      (err, stdout) => {
        if (err !== null) {
          return reject(err);
        }
        resolve(stdout);
      },
    );

    process.stdin!.end();
  });

  debug(`Command '${cmd}' completed.`);
  console.log(output);
  return output;
}

export async function getPrecompiledFhevmCoreContractsAddresses(
  ethersProvider: FhevmEthersProvider,
  fhevmPaths: FhevmEnvironmentPaths,
): Promise<PrecompiledCoreContractsAddresses> {
  debug(
    `Resolving precompiled @fhevm/core-contracts addresses using artifacts at ${fhevmPaths.resolveFhevmCoreContractsArtifactRootDir()} ...`,
  );

  if (ethersProvider.info.networkName !== "hardhat") {
    throw new HardhatFhevmError(
      `Can't retrieve ${constants.FHEVM_CORE_CONTRACTS_PACKAGE_NAME} precompiled addresses. This operation is only supported on 'hardhat' network. Current network: ${ethersProvider.info.networkName}`,
    );
  }

  const precompiledFHEVMExecutorAddress = await retrievePreCompiledFHEVMExecutorAddressFromACLArtifact(
    ethersProvider,
    fhevmPaths,
  );

  try {
    // Setup FHEVMExecutor
    const FHEVMExecutorArtifact = await fhevmPaths.getFhevmCoreContractsArtifact("FHEVMExecutor");
    const FHEVMExecutorBytecode = FHEVMExecutorArtifact.artifact.deployedBytecode;
    await ethersProvider.setCodeAt(precompiledFHEVMExecutorAddress, FHEVMExecutorBytecode);

    // Retrieve precompiled FHE addresses using FHEVMExecutor.
    const FHEVMExecutorReadOnly = new EthersT.Contract(
      precompiledFHEVMExecutorAddress,
      FHEVMExecutorArtifact.artifact.abi,
      ethersProvider.provider,
    );

    const precompiledACLAddress = (await FHEVMExecutorReadOnly.getACLAddress()) as string;
    const precompiledFHEGasLimitAddress = (await FHEVMExecutorReadOnly.getFHEGasLimitAddress()) as string;
    const precompiledInputVerifierAddress = (await FHEVMExecutorReadOnly.getInputVerifierAddress()) as string;

    const addresses = {
      ACLAddress: precompiledACLAddress,
      FHEVMExecutorAddress: precompiledFHEVMExecutorAddress,
      FHEGasLimitAddress: precompiledFHEGasLimitAddress,
      InputVerifierAddress: precompiledInputVerifierAddress,
    };

    __logPrecompiledAddresses(addresses, false);

    return addresses;
  } finally {
    await ethersProvider.setCodeAt(precompiledFHEVMExecutorAddress, "0x");
  }
}

export async function retrievePreCompiledFHEVMExecutorAddressFromACLArtifact(
  ethersProvider: FhevmEthersProvider,
  fhevmPaths: FhevmEnvironmentPaths,
): Promise<string> {
  const DUMMY_ACL_ADDR = computeDummyAddress();

  if ((await ethersProvider.getCodeAt(DUMMY_ACL_ADDR)) !== "0x") {
    throw new HardhatFhevmError("Unable to determine precompiled FHEVMExecutor address.");
  }

  try {
    const aclArtifact = await fhevmPaths.getFhevmCoreContractsArtifact("ACL");
    const aclBytecode = aclArtifact.artifact.deployedBytecode;

    await ethersProvider.setCodeAt(DUMMY_ACL_ADDR, aclBytecode);

    const dummyAcl = new EthersT.Contract(DUMMY_ACL_ADDR, aclArtifact.artifact.abi, ethersProvider.provider);

    const precompiledFHEVMExecutorAddress = await dummyAcl.getFHEVMExecutorAddress();
    return precompiledFHEVMExecutorAddress;
  } finally {
    await ethersProvider.setCodeAt(DUMMY_ACL_ADDR, "0x");
  }
}

export async function loadPrecompiledFhevmCoreContractsAddresses(
  ethersProvider: FhevmEthersProvider,
  fhevmPaths: FhevmEnvironmentPaths,
  ignoreCache: boolean,
  isRunningInHHFHEVMInstallSolidity: boolean,
): Promise<PrecompiledCoreContractsAddresses> {
  const jsonPath = fhevmPaths.cachePrecompiledFhevmCoreContractsAddressesJson;

  if (fs.existsSync(jsonPath)) {
    if (ignoreCache) {
      debug(`Remove cache file ${jsonPath}.`);
      fs.rmSync(jsonPath);
    }
  }

  if (ethersProvider.info.networkName !== "hardhat") {
    /*
      This address resolution method must be exclusively executed using the hardhat network.
      If it's not the case we spawn a process and run `npx hardhat --network hardhat> ...` manually
      This will throw an error if we are running this command recursively.

      This mechanism is required to solve situations like
      - hardhat deploy --network localhost
      - hardhat compile --network localhost
    */
    if (!fs.existsSync(jsonPath)) {
      await childProcessExecNpxHardhatFhevmInstallSolidity(isRunningInHHFHEVMInstallSolidity);
      // Now the cache file must have been generated.
      if (!fs.existsSync(jsonPath)) {
        throw new HardhatFhevmError(`Unable to generated ${jsonPath}`);
      }
    }
  }

  if (fs.existsSync(jsonPath)) {
    debug(`Skip precompiled @fhevm/core-contracts addresses resolution. Cache file ${jsonPath} already exists.`);
    const str = fs.readFileSync(jsonPath, "utf8");
    const o = JSON.parse(str);

    __logPrecompiledAddresses(o, true);

    return {
      ACLAddress: o.ACLAddress,
      FHEVMExecutorAddress: o.FHEVMExecutorAddress,
      FHEGasLimitAddress: o.FHEGasLimitAddress,
      InputVerifierAddress: o.InputVerifierAddress,
    };
  }

  const addresses = await getPrecompiledFhevmCoreContractsAddresses(ethersProvider, fhevmPaths);

  if (!fs.existsSync(fhevmPaths.cache)) {
    fs.mkdirSync(fhevmPaths.cache);
  }

  debug(`Save precompiled fhevm core contracts addresses cache file ${jsonPath}.`);

  fs.writeFileSync(jsonPath, JSON.stringify(addresses, null, 2), "utf8");

  return addresses;
}
