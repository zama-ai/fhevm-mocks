// The interfaces an `*EthereumLib.ts` adapter implements. THIS FILE IS THE SOURCE OF TRUTH for them.
//
// Declared here rather than in the package so an adapter is self-contained: copy an adapter and this
// file into your project and nothing else is needed. `fhevm-npm sync vendored` copies it to every
// vendored destination in npm-manifest.json — including each generation pkg/ts/types/, whose public.ts
// re-exports from the copy rather than declaring these types itself. So there is one definition, and
// the gate proves every copy is byte-identical to it.
export {};
//# sourceMappingURL=ethereumLibTypes.js.map