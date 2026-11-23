import { TestEngineError } from './errors.ts';

/** The port that is no fixed port: the system assigns one at the moment the node binds. */
export const SYSTEM_ASSIGNED_PORT = 0;

/** The highest fixed port. Fixed ports stay below the ports that the system assigns by itself. */
const HIGHEST_FIXED_PORT = 32767;

/**
 * Ports as the inventory and `FHEVM_TEST_PORTS` write them: one port, a range `x-y`, or a list `x,y,…`
 * whose entries are ports and ranges.
 */
export type PortSpec = number | string;

/**
 * The ports that a specification names. The result depends on the text alone: the entries are read
 * from left to right, a fixed port gives itself, a range gives its ports in increasing order, and 0
 * gives one port that the system assigns. The ports keep that order: none is sorted or dropped.
 *
 * Fails on a text that is not in one of the formats, on a fixed port outside 1 to 32767, on a range
 * that holds 0 or goes down, and on a fixed port that comes twice, directly or through two ranges.
 */
export function portsOfSpec(spec: PortSpec): readonly number[] {
  const text = String(spec);
  const ports = text.split(',').flatMap((entry) => portsOfEntry({ spec: text, entry }));
  const fixed = ports.filter(isFixedPort);

  if (new Set(fixed).size !== fixed.length) throw new TestEngineError(`'${text}' names a fixed port twice.`);

  return ports;
}

/** The fixed ports that a specification names: the ones that two nodes cannot hold at the same time. */
export function fixedPortsOfSpec(spec: PortSpec): readonly number[] {
  return portsOfSpec(spec).filter(isFixedPort);
}

export function isFixedPort(port: number): boolean {
  return port !== SYSTEM_ASSIGNED_PORT;
}

type EntryInput = {
  /** The whole specification, for the message of a failure. */
  readonly spec: string;
  /** One entry of it: a port, or a range. */
  readonly entry: string;
};

function portsOfEntry(input: EntryInput): readonly number[] {
  const { spec, entry } = input;
  const range = /^(\d+)-(\d+)$/.exec(entry);

  if (range === null) return [portNumber({ spec, entry })];

  const first = portNumber({ spec, entry: range[1] ?? '' });
  const last = portNumber({ spec, entry: range[2] ?? '' });

  if (!isFixedPort(first) || first > last) {
    throw new TestEngineError(
      `'${spec}' holds '${entry}', which is not a range: a range goes from one fixed port up to another, and never holds 0.`,
    );
  }

  return Array.from({ length: last - first + 1 }, (_unused, index) => first + index);
}

function portNumber(input: EntryInput): number {
  const port = /^\d+$/.test(input.entry) ? Number(input.entry) : Number.NaN;

  if (!(port >= SYSTEM_ASSIGNED_PORT && port <= HIGHEST_FIXED_PORT)) {
    throw new TestEngineError(
      `'${input.spec}' is not one port, a range x-y, or a list of ports and ranges: a port is 0, or from 1 to ${HIGHEST_FIXED_PORT}.`,
    );
  }

  return port;
}
