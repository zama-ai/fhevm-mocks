import { stopProcessGroup } from './process.ts';
import { type EngineProcess, processReader } from './process-reader.ts';

// The GUID is the engine's memory of its nodes when its own handles are lost, after a crash and for the
// `ps` and `kill` subcommands, and its proof that the process on a node's port is the node.

/** A running node of the engine: the processes of one process group that carry one GUID. */
export type EngineNode = {
  readonly guid: string;
  readonly groupId: number;
  readonly pids: readonly number[];
};

/** The running nodes of the engine. The engine's own process is never one of them. */
export async function listEngineNodes(): Promise<readonly EngineNode[]> {
  return nodesOf(await processReader().list());
}

function nodesOf(processes: readonly EngineProcess[]): readonly EngineNode[] {
  const nodes = new Map<string, { guid: string; groupId: number; pids: number[] }>();

  for (const { pid, groupId, guid } of processes) {
    if (pid === process.pid) continue;

    const key = `${guid} ${groupId}`;
    const node = nodes.get(key) ?? { guid, groupId, pids: [] };

    node.pids.push(pid);
    nodes.set(key, node);
  }

  return [...nodes.values()];
}

////////////////////////////////////////////////////////////////////////////////
// The listener of a port
////////////////////////////////////////////////////////////////////////////////

export type PortListenerInput = {
  readonly port: number;
  readonly guid: string;
};

/**
 * Who listens on a port, for a node that must listen there.
 * - `the-node`: a process that carries the GUID of the node.
 * - `another-process`: the engine sees the processes of the node, and none of them listens on the port,
 *   while some process does: it took the port before the node could.
 * - `unknown`: the engine cannot tell. It sees no listener, or it cannot read the processes.
 */
export type PortListener = 'the-node' | 'another-process' | 'unknown';

/**
 * Says whether the process that listens on a port is the node with the given GUID. An answer on the
 * port proves only that some node listens there. This proves that the node is the engine's own, also
 * behind a wrapper such as `npx`: the real node process inherits the GUID.
 *
 * The engine names another process only when it can see the node's own processes. When it sees none,
 * it may be unable to read processes at all, and so it says that it does not know.
 */
export async function portListener(input: PortListenerInput): Promise<PortListener> {
  const reader = processReader();
  const listeners = await reader.listenersOn(input.port);
  const ofTheNode = (await reader.list()).filter((candidate) => candidate.guid === input.guid);

  if (ofTheNode.some((candidate) => listeners.includes(candidate.pid))) return 'the-node';

  return listeners.length > 0 && ofTheNode.length > 0 ? 'another-process' : 'unknown';
}

////////////////////////////////////////////////////////////////////////////////
// Stopping
////////////////////////////////////////////////////////////////////////////////

export type StopEngineNodesInput = {
  /** The GUIDs of the nodes to stop. */
  readonly guids: readonly string[];
};

/**
 * Stops the nodes of the engine that carry the given GUIDs, each with its whole process group, and
 * returns the GUIDs it stopped. The GUID of a node is read again right before its group is stopped:
 * a process ID can have gone to another process since the listing.
 */
export async function stopEngineNodes(input: StopEngineNodesInput): Promise<ReadonlySet<string>> {
  const reader = processReader();
  const wanted = new Set(input.guids);
  const nodes = nodesOf(await reader.list()).filter((node) => wanted.has(node.guid));

  const stopped = await Promise.all(
    nodes.map(async (node) => {
      const guids = await Promise.all(node.pids.map((pid) => reader.guidOf(pid)));

      if (!guids.includes(node.guid)) return undefined;

      await stopProcessGroup(node.groupId);

      return node.guid;
    }),
  );

  return new Set(stopped.filter((guid) => guid !== undefined));
}
