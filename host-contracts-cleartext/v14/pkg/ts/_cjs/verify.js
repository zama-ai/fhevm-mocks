"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MAY_CHANGE = void 0;
exports.snapshotStack = snapshotStack;
exports.verify = verify;
const ACL_js_1 = require("./artifacts/ACL.js");
const ACLOwner_js_1 = require("./artifacts/ACLOwner.js");
const CleartextArithmetic_js_1 = require("./artifacts/CleartextArithmetic.js");
const CleartextDB_js_1 = require("./artifacts/CleartextDB.js");
const CleartextFHEVMExecutor_js_1 = require("./artifacts/CleartextFHEVMExecutor.js");
const CleartextInputVerifier_js_1 = require("./artifacts/CleartextInputVerifier.js");
const CleartextKMSVerifier_js_1 = require("./artifacts/CleartextKMSVerifier.js");
const HCULimit_js_1 = require("./artifacts/HCULimit.js");
const KMSGeneration_js_1 = require("./artifacts/KMSGeneration.js");
const PauserSet_js_1 = require("./artifacts/PauserSet.js");
const ProtocolConfig_js_1 = require("./artifacts/ProtocolConfig.js");
const versions_js_1 = require("./versions.js");
const IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
function targetsOf(deployed) {
    const f = deployed.fhevmAddresses;
    const c = deployed.cleartextAddresses ?? {};
    const all = [
        { label: 'ACL', address: f.aclAddress, abi: ACL_js_1.abi, versionKey: 'acl', isProxy: true },
        {
            label: 'FHEVMExecutor',
            address: f.fhevmExecutorAddress,
            abi: CleartextFHEVMExecutor_js_1.abi,
            versionKey: 'fhevmExecutor',
            isProxy: true,
        },
        {
            label: 'KMSVerifier',
            address: f.kmsVerifierAddress,
            abi: CleartextKMSVerifier_js_1.abi,
            versionKey: 'kmsVerifier',
            isProxy: true,
        },
        {
            label: 'InputVerifier',
            address: f.inputVerifierAddress,
            abi: CleartextInputVerifier_js_1.abi,
            versionKey: 'inputVerifier',
            isProxy: true,
        },
        { label: 'HCULimit', address: f.hcuLimitAddress, abi: HCULimit_js_1.abi, versionKey: 'hcuLimit', isProxy: true },
        {
            label: 'ProtocolConfig',
            address: f.protocolConfigAddress,
            abi: ProtocolConfig_js_1.abi,
            versionKey: 'protocolConfig',
            isProxy: true,
        },
        {
            label: 'KMSGeneration',
            address: f.kmsGenerationAddress,
            abi: KMSGeneration_js_1.abi,
            versionKey: 'kmsGeneration',
            isProxy: true,
        },
        {
            label: 'CleartextArithmetic',
            address: c.cleartextArithmeticAddress,
            abi: CleartextArithmetic_js_1.abi,
            versionKey: 'cleartextArithmetic',
            isProxy: true,
        },
        {
            label: 'CleartextDB',
            address: c.cleartextDbAddress,
            abi: CleartextDB_js_1.abi,
            versionKey: 'cleartextDB',
            isProxy: true,
        },
        {
            label: 'PauserSet',
            address: deployed.pauserSetAddress,
            abi: PauserSet_js_1.abi,
            versionKey: 'pauserSet',
            isProxy: false,
        },
        { label: 'ACLOwner', address: deployed.aclOwnerAddress, abi: ACLOwner_js_1.abi, isProxy: false },
    ].map((t) => (t.address === undefined ? null : { ...t, address: t.address }));
    return all.filter((t) => t !== null);
}
function sameAddress(a, b) {
    return a.toLowerCase() === b.toLowerCase();
}
function stringifyReading(value) {
    if (value === undefined)
        return 'undefined';
    return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? `${v.toString()}n` : v));
}
function zeroArgGetters(abi) {
    const names = [];
    for (const entry of abi) {
        const e = entry;
        if (e.type !== 'function' || e.name === undefined)
            continue;
        if (e.stateMutability !== 'view' && e.stateMutability !== 'pure')
            continue;
        if ((e.inputs ?? []).length !== 0)
            continue;
        names.push(e.name);
    }
    return names;
}
async function readAll(ethProvider, targets) {
    const readings = {};
    for (const target of targets) {
        for (const functionName of zeroArgGetters(target.abi)) {
            let reading;
            try {
                reading = stringifyReading(await ethProvider.readContract({ address: target.address, abi: target.abi, functionName }));
            }
            catch {
                reading = '<reverted>';
            }
            readings[`${target.label}.${functionName}`] = reading;
        }
    }
    return readings;
}
async function snapshotStack(parameters) {
    const targets = withAbiOverrides(targetsOf(parameters.deployed), parameters.abis);
    const blockNumber = parameters.history === undefined ? null : await parameters.history.getBlockNumber();
    return { blockNumber, readings: await readAll(parameters.ethProvider, targets) };
}
function withAbiOverrides(targets, abis) {
    if (abis === undefined)
        return targets;
    return targets.map((t) => {
        const override = abis[t.label];
        return override === undefined ? t : { ...t, abi: override };
    });
}
class Report {
    constructor() {
        Object.defineProperty(this, "checks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    pass(name) {
        this.checks.push({ name, status: 'pass' });
    }
    fail(name, detail) {
        this.checks.push({ name, status: 'fail', detail });
    }
    skip(name, detail) {
        this.checks.push({ name, status: 'skip', detail });
    }
    expect(name, ok, detail) {
        if (ok)
            this.pass(name);
        else
            this.fail(name, detail());
    }
    expectAddress(name, got, want) {
        this.expect(name, sameAddress(got, want), () => `got ${got}, want ${want}`);
    }
    expectEqual(name, got, want) {
        const g = stringifyReading(got);
        const w = stringifyReading(want);
        this.expect(name, g === w, () => `got ${g}, want ${w}`);
    }
    finish() {
        const checks = [...this.checks];
        const failures = checks.filter((c) => c.status === 'fail');
        const skipped = checks.filter((c) => c.status === 'skip');
        return { ok: failures.length === 0, checks, failures, skipped };
    }
}
async function checkCode(report, ethProvider, targets) {
    for (const target of targets) {
        let code;
        try {
            code = await ethProvider.getCodeAt({ address: target.address });
        }
        catch {
            code = '0x';
        }
        report.expect(`code.${target.label}`, code.length > 2, () => `no code at ${target.address} — nothing is deployed there`);
    }
}
async function checkMaterialized(report, history, targets) {
    const proxies = targets.filter((t) => t.isProxy);
    if (history === undefined) {
        for (const target of proxies) {
            report.skip(`materialized.${target.label}`, "needs `history.getStorageAt` — a proxy's code is identical before and after it is pointed at a " +
                'real implementation, so this cannot be inferred from code alone');
        }
        return;
    }
    for (const target of proxies) {
        const raw = await history.getStorageAt({ address: target.address, slot: IMPLEMENTATION_SLOT });
        report.expect(`materialized.${target.label}`, BigInt(raw === '0x' ? '0x0' : raw) !== 0n, () => `${target.label} still points at the zero implementation — it was never materialized`);
    }
}
async function checkVersions(report, ethProvider, targets) {
    for (const target of targets) {
        if (target.versionKey === undefined)
            continue;
        const want = versions_js_1.CONTRACT_VERSIONS[target.versionKey];
        try {
            const got = (await ethProvider.readContract({
                address: target.address,
                abi: target.abi,
                functionName: 'getVersion',
            }));
            report.expect(`version.${target.label}`, got === want, () => `got "${got}", want "${want}"`);
        }
        catch (error) {
            report.fail(`version.${target.label}`, `getVersion() reverted: ${String(error)}`);
        }
    }
}
async function checkWiring(report, ethProvider, deployed) {
    const { fhevmAddresses: f, cleartextAddresses: c } = deployed;
    const wiring = [
        {
            name: 'ACL.getFHEVMExecutorAddress',
            address: f.aclAddress,
            abi: ACL_js_1.abi,
            functionName: 'getFHEVMExecutorAddress',
            want: f.fhevmExecutorAddress,
        },
        {
            name: 'ACL.getPauserSetAddress',
            address: f.aclAddress,
            abi: ACL_js_1.abi,
            functionName: 'getPauserSetAddress',
            want: deployed.pauserSetAddress,
        },
        {
            name: 'FHEVMExecutor.getACLAddress',
            address: f.fhevmExecutorAddress,
            abi: CleartextFHEVMExecutor_js_1.abi,
            functionName: 'getACLAddress',
            want: f.aclAddress,
        },
        {
            name: 'FHEVMExecutor.getHCULimitAddress',
            address: f.fhevmExecutorAddress,
            abi: CleartextFHEVMExecutor_js_1.abi,
            functionName: 'getHCULimitAddress',
            want: f.hcuLimitAddress,
        },
        {
            name: 'FHEVMExecutor.getInputVerifierAddress',
            address: f.fhevmExecutorAddress,
            abi: CleartextFHEVMExecutor_js_1.abi,
            functionName: 'getInputVerifierAddress',
            want: f.inputVerifierAddress,
        },
        {
            name: 'FHEVMExecutor.getCleartextArithmeticAddress',
            address: f.fhevmExecutorAddress,
            abi: CleartextFHEVMExecutor_js_1.abi,
            functionName: 'getCleartextArithmeticAddress',
            want: c.cleartextArithmeticAddress,
        },
        {
            name: 'HCULimit.getFHEVMExecutorAddress',
            address: f.hcuLimitAddress,
            abi: HCULimit_js_1.abi,
            functionName: 'getFHEVMExecutorAddress',
            want: f.fhevmExecutorAddress,
        },
        {
            name: 'CleartextArithmetic.getCleartextDBAddress',
            address: c.cleartextArithmeticAddress,
            abi: CleartextArithmetic_js_1.abi,
            functionName: 'getCleartextDBAddress',
            want: c.cleartextDbAddress,
        },
        {
            name: 'CleartextDB.getACLAddress',
            address: c.cleartextDbAddress,
            abi: CleartextDB_js_1.abi,
            functionName: 'getACLAddress',
            want: f.aclAddress,
        },
    ];
    for (const w of wiring) {
        try {
            const got = (await ethProvider.readContract({
                address: w.address,
                abi: w.abi,
                functionName: w.functionName,
            }));
            report.expectAddress(`wiring.${w.name}`, got, w.want);
        }
        catch (error) {
            report.fail(`wiring.${w.name}`, `reverted — is the proxy materialized? ${String(error)}`);
        }
    }
}
async function checkOwnership(report, ethProvider, deployed, expected) {
    const read = async (address, abi, functionName) => (await ethProvider.readContract({ address, abi, functionName }));
    const acl = deployed.fhevmAddresses.aclAddress;
    const aclOwner = deployed.aclOwnerAddress;
    report.expectAddress('ownership.ACL.owner', await read(acl, ACL_js_1.abi, 'owner'), aclOwner);
    report.expectAddress('ownership.ACL.pendingOwner', await read(acl, ACL_js_1.abi, 'pendingOwner'), ZERO_ADDRESS);
    report.expectAddress('ownership.ACLOwner.ACL_ADDRESS', await read(aclOwner, ACLOwner_js_1.abi, 'ACL_ADDRESS'), acl);
    report.expectAddress('ownership.ACLOwner.pendingOwner', await read(aclOwner, ACLOwner_js_1.abi, 'pendingOwner'), ZERO_ADDRESS);
    const admin = expected?.admin;
    if (admin === undefined) {
        report.skip('ownership.ACLOwner.owner', 'no `expected.admin` supplied — who SHOULD own the stack is not something this can derive');
        return;
    }
    report.expectAddress('ownership.ACLOwner.owner', await read(aclOwner, ACLOwner_js_1.abi, 'owner'), admin);
}
async function checkPausers(report, ethProvider, deployed, expected) {
    const isPauser = async (account) => (await ethProvider.readContract({
        address: deployed.pauserSetAddress,
        abi: PauserSet_js_1.abi,
        functionName: 'isPauser',
        args: [account],
    }));
    report.expect('pausers.ACLOwner', await isPauser(deployed.aclOwnerAddress), () => 'the ACLOwner is not a pauser — the stack cannot be paused through its own upgrade root');
    for (const account of expected?.pausers ?? []) {
        report.expect(`pausers.${account}`, await isPauser(account), () => `${account} is not a pauser`);
    }
}
async function checkBootstrap(report, ethProvider, deployed, expected) {
    if (expected === undefined)
        return;
    const f = deployed.fhevmAddresses;
    const read = (address, abi, functionName) => ethProvider.readContract({ address, abi, functionName });
    if (expected.coprocessorSigners !== undefined) {
        const got = (await read(f.inputVerifierAddress, CleartextInputVerifier_js_1.abi, 'getCoprocessorSigners'));
        report.expect('bootstrap.coprocessorSigners', got.length === expected.coprocessorSigners.length &&
            got.every((a, i) => sameAddress(a, expected.coprocessorSigners?.[i] ?? '')), () => `got [${got.join(', ')}], want [${(expected.coprocessorSigners ?? []).join(', ')}]`);
    }
    if (expected.coprocessorThreshold !== undefined) {
        report.expectEqual('bootstrap.coprocessorThreshold', await read(f.inputVerifierAddress, CleartextInputVerifier_js_1.abi, 'getThreshold'), expected.coprocessorThreshold);
    }
    if (expected.kmsSigners !== undefined) {
        const got = (await read(f.protocolConfigAddress, ProtocolConfig_js_1.abi, 'getKmsSigners'));
        report.expect('bootstrap.kmsSigners', got.length === expected.kmsSigners.length && got.every((a, i) => sameAddress(a, expected.kmsSigners?.[i] ?? '')), () => `got [${got.join(', ')}], want [${(expected.kmsSigners ?? []).join(', ')}]`);
    }
    if (expected.kmsContextId !== undefined) {
        report.expectEqual('bootstrap.kmsContextId', await read(f.protocolConfigAddress, ProtocolConfig_js_1.abi, 'getCurrentKmsContextId'), expected.kmsContextId);
    }
    const thresholds = expected.kmsThresholds;
    if (thresholds !== undefined) {
        const getters = [
            ['publicDecryption', 'getPublicDecryptionThreshold'],
            ['userDecryption', 'getUserDecryptionThreshold'],
            ['kmsGen', 'getKmsGenThreshold'],
            ['mpc', 'getMpcThreshold'],
        ];
        for (const [key, functionName] of getters) {
            report.expectEqual(`bootstrap.kmsThresholds.${key}`, await read(f.protocolConfigAddress, ProtocolConfig_js_1.abi, functionName), thresholds[key]);
        }
    }
}
exports.DEFAULT_MAY_CHANGE = [
    'ProtocolConfig.getVersion',
    'KMSGeneration.getVersion',
    'ACL.getVersion',
    'FHEVMExecutor.getVersion',
    'HCULimit.getVersion',
    'KMSVerifier.getVersion',
    'CleartextArithmetic.getVersion',
    'HCULimit.getBlockMeter',
];
const OWNERSHIP_EVENTS = ['OwnershipTransferStarted', 'OwnershipTransferred'];
const PAUSER_EVENTS = ['AddPauser', 'RemovePauser', 'SwapPauser'];
function checkSurvival(report, before, after, mayChange) {
    const exempt = new Set(mayChange);
    const vanished = Object.keys(before.readings).filter((key) => !(key in after));
    report.expect('survival.noGetterVanished', vanished.length === 0, () => vanished.join(', '));
    const changed = [];
    for (const [key, was] of Object.entries(before.readings)) {
        if (exempt.has(key) || !(key in after))
            continue;
        const now = after[key];
        if (now !== was)
            changed.push(`${key}: ${was} -> ${String(now)}`);
    }
    report.expect('survival.everythingElseUnchanged', changed.length === 0, () => changed.join('\n'));
    const unused = mayChange.filter((key) => key in before.readings && before.readings[key] === after[key]);
    report.expect('survival.exemptionsWereUsed', unused.length === 0, () => `these are exempt but did not change — remove them: ${unused.join(', ')}`);
}
async function checkNoAuthorityEvents(report, history, deployed, before) {
    const names = ['events.ownership', 'events.pausers'];
    if (history === undefined || before.blockNumber === null) {
        const why = history === undefined
            ? 'needs `history.getLogs`'
            : 'the snapshot carries no block number — pass `history` to `snapshotStack` too';
        for (const name of names) {
            report.skip(name, `${why}. Without it, "nobody was ADDED to the pauser set" cannot be shown at all: PauserSet has ` +
                'no enumeration, so value comparison only covers accounts someone thought to name');
        }
        return;
    }
    const fromBlock = before.blockNumber + 1n;
    const scans = [
        ['events.ownership', deployed.fhevmAddresses.aclAddress, ACL_js_1.abi, OWNERSHIP_EVENTS],
        ['events.ownership', deployed.aclOwnerAddress, ACLOwner_js_1.abi, OWNERSHIP_EVENTS],
        ['events.pausers', deployed.pauserSetAddress, PauserSet_js_1.abi, PAUSER_EVENTS],
    ];
    for (const [name, address, abi, eventNames] of scans) {
        const logs = await history.getLogs({ address, abi, eventNames, fromBlock, toBlock: 'latest' });
        report.expect(name, logs.length === 0, () => `${address} emitted ${logs.map((l) => l.eventName).join(', ')} during the upgrade`);
    }
}
async function verify(parameters) {
    const report = new Report();
    const { ethProvider, history, deployed, expected } = parameters;
    const targets = targetsOf(deployed);
    await checkCode(report, ethProvider, targets);
    await checkMaterialized(report, history, targets);
    await checkVersions(report, ethProvider, targets);
    await checkWiring(report, ethProvider, deployed);
    await checkOwnership(report, ethProvider, deployed, expected);
    await checkPausers(report, ethProvider, deployed, expected);
    await checkBootstrap(report, ethProvider, deployed, expected);
    if (parameters.mode === 'upgrade') {
        const after = await readAll(ethProvider, withAbiOverrides(targets, parameters.abis));
        checkSurvival(report, parameters.before, after, parameters.mayChange ?? exports.DEFAULT_MAY_CHANGE);
        await checkNoAuthorityEvents(report, history, deployed, parameters.before);
    }
    return report.finish();
}
//# sourceMappingURL=verify.js.map