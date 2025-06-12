/**
 * Returns `true` if the Typescript code is running within a node process, `false` otherwise
 */
export function isNodeRuntime() {
  return typeof process !== "undefined" && process.versions != null && process.versions.node != null;
}

declare var Bun: {
  version: string;
};

/**
 * Returns `true` if the Typescript code is running within a bun process, `false` otherwise
 */
export function isBunRuntime() {
  return typeof Bun !== "undefined";
}
