export type HexString = `0x${string}`;
export type ContractKind = 'proxy' | 'non-proxy';
export type AddressReference = {
    readonly placeholder: HexString;
    readonly bytecodeOffsets: readonly number[];
    readonly deployedBytecodeOffsets: readonly number[];
};
export type ContractTemplate = {
    readonly contractName: string;
    readonly kind: ContractKind;
    readonly sourcePath: string;
    readonly artifactPath: string;
    readonly bytecode: HexString;
    readonly deployedBytecode: HexString;
    readonly addressReferences: Readonly<Record<string, AddressReference>>;
};
//# sourceMappingURL=types.d.ts.map