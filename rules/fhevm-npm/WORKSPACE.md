# The npm workspace

The rules in [rules/](rules/README.md) run `sdk/` on npm workspaces with no `.tgz` file in the dependency graph, while they keep every guarantee that a tarball install used to give. Each rule was verified against this workspace, not assumed. npm and pnpm differ sharply here, and several rules exist because the obvious spec is the unsafe one.

## Generations side by side

Some package families exist in several generations side by side. `host-contracts-cleartext/<vN-1>` and `host-contracts-cleartext/<vN>`, for example, are two dev packages whose payloads share one published name. [D-02](../global/definitions/entries/D-02.md) defines a generation, and [R-05](../global/rules/entries/R-05.md) gives the notation `<vN>` and `<vN-1>`.

`npm-manifest.json#generations` names the generations of each family. `current` is `<vN>`, the generation that every consumer depends on. `previous` is `<vN-1>`, kept only so that the upgrade path from `<vN-1>` to `<vN>` can be built and tested.

The rules of the Generations group, [NR-22](rules/entries/NR-22.md) to [NR-27](rules/entries/NR-27.md), say what each generation may depend on and what each one declares.
