////////////////////////////////////////////////////////////////////////////////
/**
 * Nonce offset, relative to the deployer's start nonce, at which each host proxy is created by
 * `deployEmptyProxies` — and the authoritative statement of the deploy layout on the TS side.
 *
 * Offsets 0 and 2 carry no named address: they are the two empty-proxy implementations the proxies are
 * constructed over (`EmptyUUPSProxyACL`, and the shared `EmptyUUPSProxy`). That is why the numbering has
 * gaps and cannot be an index.
 *
 * `satisfies Record<keyof FhevmAddresses, bigint>` is the load-bearing part: adding a field to
 * `FhevmAddresses` without giving it an offset here is a compile error rather than an address that
 * silently reads `undefined`.
 *
 * `internal/constants.ts` mirrors this table for the harness generators, which cannot import `pkg/ts`
 * (see its `HOST_NONCE_OFFSET` comment for why). The two must move together; `test/templates.test.ts`
 * and `test/ts/precompute-addresses.test.ts` are what catch a divergence.
 */
const HOST_NONCE_OFFSET = {
    aclAddress: 1n,
    fhevmExecutorAddress: 3n,
    kmsVerifierAddress: 4n,
    inputVerifierAddress: 5n,
    hcuLimitAddress: 6n,
    protocolConfigAddress: 7n,
    kmsGenerationAddress: 8n,
};
/**
 * How many nonces the host block consumes — one past its highest offset, so the unnamed empty-proxy
 * implementations at 0 and 2 are counted too.
 *
 * Derived rather than written down. Everything after the host block is positioned against this, so a
 * literal here would be a second thing to remember every time the block grows or shrinks — which is
 * exactly what a generation change does.
 */
const HOST_NONCE_COUNT = Object.values(HOST_NONCE_OFFSET).reduce((highest, offset) => (offset > highest ? offset : highest), 0n) + 1n;
////////////////////////////////////////////////////////////////////////////////
function precomputeFhevmAddresses(parameters) {
    const at = (offset) => parameters.ethUtils.getContractAddress({ from: parameters.from, nonce: parameters.startNonce + offset });
    return {
        fhevmAddresses: {
            aclAddress: at(HOST_NONCE_OFFSET.aclAddress),
            fhevmExecutorAddress: at(HOST_NONCE_OFFSET.fhevmExecutorAddress),
            kmsVerifierAddress: at(HOST_NONCE_OFFSET.kmsVerifierAddress),
            inputVerifierAddress: at(HOST_NONCE_OFFSET.inputVerifierAddress),
            hcuLimitAddress: at(HOST_NONCE_OFFSET.hcuLimitAddress),
            protocolConfigAddress: at(HOST_NONCE_OFFSET.protocolConfigAddress),
            kmsGenerationAddress: at(HOST_NONCE_OFFSET.kmsGenerationAddress),
        },
        nextStartNonce: parameters.startNonce + HOST_NONCE_COUNT,
    };
}
////////////////////////////////////////////////////////////////////////////////
export function precomputeAddresses(parameters) {
    const { fhevmAddresses, nextStartNonce } = precomputeFhevmAddresses(parameters);
    const at = (nonce) => parameters.ethUtils.getContractAddress({ from: parameters.from, nonce });
    // The cleartext-infra proxies follow the host block, then PauserSet. Their offsets are not chosen —
    // they are `HOST_NONCE_COUNT + k` — so a host contract added or removed shifts them automatically.
    const cleartextAddresses = {
        cleartextArithmeticAddress: at(nextStartNonce),
        cleartextDbAddress: at(nextStartNonce + 1n),
    };
    return {
        fhevmAddresses,
        cleartextAddresses,
        pauserSetAddress: at(nextStartNonce + 2n),
        nextStartNonce: nextStartNonce + 3n,
    };
}
//# sourceMappingURL=addresses.js.map