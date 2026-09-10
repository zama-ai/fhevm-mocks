"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendStep = sendStep;
exports.checkDeployedBytecode = checkDeployedBytecode;
exports.assertDeployedAddress = assertDeployedAddress;
exports.assertNoCodeAt = assertNoCodeAt;
exports.assertNoCodeAtTargets = assertNoCodeAtTargets;
exports.patchTemplateBytecode = patchTemplateBytecode;
exports.assertNoPlaceholdersRemain = assertNoPlaceholdersRemain;
exports.deployImplementation = deployImplementation;
exports.deployImplementations = deployImplementations;
exports.buildHostAddressReplacements = buildHostAddressReplacements;
function normalizeHex(value, label) {
    if (!/^0x[0-9a-fA-F]*$/.test(value)) {
        throw new Error(`${label} is not a hex string`);
    }
    const hex = value.slice(2).toLowerCase();
    if (hex.length % 2 !== 0) {
        throw new Error(`${label} has an odd hex length`);
    }
    return hex;
}
const ADAPTER_NONCE_HINT = 'The AbstractEthereumSigner implementation may be letting its web3 library choose nonces. ethers v6 ' +
    'caches eth_getTransactionCount for 250ms, so consecutive sends receive a stale count (viem re-reads ' +
    'it per send and is not affected). An adapter must read the count once per signer and advance it ' +
    'locally, sending each transaction with an explicit nonce. See AbstractEthereumSigner in types/public.ts.';
async function sendStep(parameters) {
    try {
        return await parameters.send();
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const hint = /nonce/i.test(message) ? ` ${ADAPTER_NONCE_HINT}` : '';
        throw new Error(`${parameters.label} failed: ${message}${hint}`, { cause: error });
    }
}
async function checkDeployedBytecode(parameters) {
    const onChainCode = await parameters.ethProvider.getCodeAt({ address: parameters.address });
    const actual = normalizeHex(onChainCode, `on-chain code at ${parameters.address}`);
    if (actual.length === 0) {
        return { status: 'not-deployed' };
    }
    const expected = normalizeHex(parameters.expectedDeployedBytecode, 'expected deployed bytecode');
    if (actual === expected) {
        return { status: 'match' };
    }
    return { status: 'mismatch', actualDeployedBytecode: `0x${actual}`, expectedDeployedBytecode: `0x${expected}` };
}
function assertDeployedAddress(parameters) {
    const expectedAddress = normalizeHex(parameters.expectedAddress, `${parameters.contractName} expected address`);
    const actualAddress = normalizeHex(parameters.actualAddress, `${parameters.contractName} deployed address`);
    if (actualAddress !== expectedAddress) {
        throw new Error(`${parameters.contractName} deployed at ${parameters.actualAddress}, expected ${parameters.expectedAddress}. ` +
            `The deployer's nonce sequence diverged. ${ADAPTER_NONCE_HINT} ` +
            `If the addresses were supplied via \`precomputed\`, check they were derived from this deployer ` +
            `and start nonce.`);
    }
}
async function assertNoCodeAt(parameters) {
    const code = normalizeHex(await parameters.ethProvider.getCodeAt({ address: parameters.address }), `${parameters.contractName} address code`);
    if (code.length !== 0) {
        throw new Error(`${parameters.contractName} address ${parameters.address} already has code deployed`);
    }
}
async function assertNoCodeAtTargets(parameters) {
    for (const target of parameters.targets) {
        await assertNoCodeAt({
            ethProvider: parameters.ethProvider,
            contractName: target.contractName,
            address: target.address,
        });
    }
}
function patchTemplateBytecode(parameters) {
    const offsetField = parameters.field === 'bytecode' ? 'bytecodeOffsets' : 'deployedBytecodeOffsets';
    let hex = normalizeHex(parameters.template[parameters.field], `${parameters.template.contractName}.${parameters.field}`);
    for (const replacement of parameters.replacements) {
        const reference = parameters.template.addressReferences[replacement.referenceName];
        if (reference === undefined) {
            throw new Error(`${parameters.template.contractName} template is missing ${replacement.referenceName}`);
        }
        const placeholder = normalizeHex(reference.placeholder, `${parameters.template.contractName}.${replacement.referenceName}.placeholder`);
        const replacementHex = normalizeHex(replacement.replacement, `${replacement.referenceName} replacement`);
        if (replacementHex.length !== placeholder.length) {
            throw new Error(`${replacement.referenceName} replacement must have the same length as its placeholder`);
        }
        for (const byteOffset of reference[offsetField]) {
            const hexOffset = byteOffset * 2;
            if (hex.slice(hexOffset, hexOffset + placeholder.length) !== placeholder) {
                throw new Error(`${parameters.template.contractName}.${parameters.field} ${replacement.referenceName} offset ${byteOffset} does not point to the placeholder`);
            }
            hex = `${hex.slice(0, hexOffset)}${replacementHex}${hex.slice(hexOffset + placeholder.length)}`;
        }
    }
    assertNoPlaceholdersRemain({
        template: parameters.template,
        field: parameters.field,
        patchedHex: hex,
    });
    return `0x${hex}`;
}
function assertNoPlaceholdersRemain(parameters) {
    const hex = parameters.patchedHex.startsWith('0x') ? parameters.patchedHex.slice(2) : parameters.patchedHex;
    for (const referenceName of Object.keys(parameters.template.addressReferences)) {
        const reference = parameters.template.addressReferences[referenceName];
        if (reference === undefined) {
            continue;
        }
        const placeholder = normalizeHex(reference.placeholder, `${parameters.template.contractName}.${referenceName}.placeholder`);
        const survivingIndex = hex.indexOf(placeholder);
        if (survivingIndex !== -1) {
            throw new Error(`${parameters.template.contractName}.${parameters.field}: placeholder for ${referenceName} ` +
                `(0x${placeholder}) still present at byte ${String(survivingIndex / 2)} after patching. ` +
                `Deploying this would bake a marker address into the contract. Either the template's ` +
                `offsets are stale (regenerate with \`make generate\`) or no replacement was ` +
                `supplied for ${referenceName}.`);
        }
    }
}
const UPGRADE_TO_AND_CALL_ABI = [
    {
        type: 'function',
        name: 'upgradeToAndCall',
        stateMutability: 'payable',
        inputs: [
            { name: 'newImplementation', type: 'address' },
            { name: 'data', type: 'bytes' },
        ],
        outputs: [],
    },
];
async function deployImplementation(parameters) {
    const bytecode = patchTemplateBytecode({
        template: parameters.template,
        field: 'bytecode',
        replacements: parameters.addressReplacements,
    });
    const { contractAddress: implementationAddress } = await sendStep({
        label: `${parameters.contractName} implementation deploy`,
        send: () => parameters.deployer.deploy({ bytecode }),
    });
    const initData = await parameters.ethUtils.encodeCall({
        abi: parameters.abi,
        functionName: parameters.spec.initFn,
        args: parameters.spec.initArgs,
    });
    const upgradeCalldata = await parameters.ethUtils.encodeCall({
        abi: UPGRADE_TO_AND_CALL_ABI,
        functionName: 'upgradeToAndCall',
        args: [implementationAddress, initData],
    });
    return {
        contractName: parameters.contractName,
        proxyAddress: parameters.proxyAddress,
        implementationAddress,
        initData,
        upgradeCalldata,
    };
}
async function deployImplementations(parameters) {
    const implementations = [];
    for (const target of parameters.targets) {
        implementations.push(await deployImplementation({
            ethUtils: parameters.ethUtils,
            deployer: parameters.deployer,
            contractName: target.contractName,
            proxyAddress: target.proxyAddress,
            template: target.template,
            abi: target.abi,
            addressReplacements: parameters.addressReplacements,
            spec: target.spec,
        }));
    }
    return implementations;
}
function buildHostAddressReplacements(parameters) {
    const replacements = [
        { referenceName: 'ACL_ADDRESS', replacement: parameters.fhevmAddresses.aclAddress },
        { referenceName: 'FHEVM_EXECUTOR_ADDRESS', replacement: parameters.fhevmAddresses.fhevmExecutorAddress },
        { referenceName: 'KMS_VERIFIER_ADDRESS', replacement: parameters.fhevmAddresses.kmsVerifierAddress },
        { referenceName: 'INPUT_VERIFIER_ADDRESS', replacement: parameters.fhevmAddresses.inputVerifierAddress },
        { referenceName: 'HCU_LIMIT_ADDRESS', replacement: parameters.fhevmAddresses.hcuLimitAddress },
        { referenceName: 'PROTOCOL_CONFIG_ADDRESS', replacement: parameters.fhevmAddresses.protocolConfigAddress },
        { referenceName: 'KMS_GENERATION_ADDRESS', replacement: parameters.fhevmAddresses.kmsGenerationAddress },
        { referenceName: 'PAUSER_SET_ADDRESS', replacement: parameters.pauserSetAddress },
    ];
    if (parameters.cleartextAddresses !== undefined) {
        replacements.push({
            referenceName: 'CLEARTEXT_ARITHMETIC_ADDRESS',
            replacement: parameters.cleartextAddresses.cleartextArithmeticAddress,
        }, { referenceName: 'CLEARTEXT_DB_ADDRESS', replacement: parameters.cleartextAddresses.cleartextDbAddress });
    }
    return replacements;
}
//# sourceMappingURL=utils.js.map