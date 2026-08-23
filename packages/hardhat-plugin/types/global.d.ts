// TypeScript 6 no longer auto-includes every package under `node_modules/@types`; only types that are
// explicitly imported or referenced get loaded. `chai-as-promised` is registered at runtime by
// `@nomicfoundation/hardhat-chai-matchers` rather than imported by any test, so nothing pulls its
// declarations in — and `expect(...).to.be.rejectedWith(...)` stops typechecking (TS2551, which
// suggests `revertedWith`, the one augmentation that *is* referenced).
//
// Referencing it here restores the `Chai.Assertion` augmentation across the whole test project.
/// <reference types="chai-as-promised" />
