import type { AbstractEthereumUtils, CleartextAddresses, FhevmAddresses } from './types/public.js';
export declare function precomputeAddresses(parameters: {
    readonly ethUtils: AbstractEthereumUtils;
    readonly from: `0x${string}`;
    readonly startNonce: bigint;
}): {
    fhevmAddresses: FhevmAddresses;
    cleartextAddresses: CleartextAddresses;
    pauserSetAddress: string;
    nextStartNonce: bigint;
};
//# sourceMappingURL=addresses.d.ts.map