import { setTimeout as sleep } from 'node:timers/promises';

import { portListener } from './engine-processes.ts';
import { TestEngineError } from './errors.ts';
import { GUID_VARIABLE, environmentWithoutGuid, newGuid } from './guid.ts';
import type { Chain, NodeChain, Test } from './inventory.ts';
import type { NodeLog } from './node-log.ts';
import { isFixedPort, portsOfSpec } from './port-spec.ts';
import { freePort } from './ports.ts';
import { type GroupProcess, describeExit, startInGroup } from './process.ts';
import { ethChainId } from './rpc.ts';
import type { TestLog } from './test-log.ts';

/** The address every node of the engine listens on. */
const NODE_HOST = '127.0.0.1';

/** How long a node gets to answer its first call. */
const READY_LIMIT_MILLISECONDS = 60_000;

/** How long the engine keeps asking the system who listens on the port of a node that answers. */
const LISTENER_LIMIT_MILLISECONDS = 15_000;

/** How often the engine calls a node that has not answered yet. */
const READY_POLL_MILLISECONDS = 100;

type NodeCommandInput = {
  readonly port: number;
  readonly chainId: number;
};

/**
 * The command that starts a node of each runtime, from the root. A Hardhat node takes its chain id from
 * the Hardhat project of the root, so the engine checks the chain id of every node once it answers.
 * Hardhat must be installed there already: the engine installs nothing.
 */
const NODE_COMMANDS: Readonly<Record<NodeChain['runtime'], (input: NodeCommandInput) => string>> = {
  anvil: ({ port, chainId }) => `anvil --host ${NODE_HOST} --port ${port} --chain-id ${chainId}`,
  'hardhat-node': ({ port }) => `npx --no-install hardhat node --hostname ${NODE_HOST} --port ${port}`,
};

/** A node that the engine started for one test, and that answered. */
export type RunningNode = {
  readonly guid: string;
  readonly url: string;
  readonly port: number;
  /**
   * How the node ended, when it died: it ended although the engine did not stop it, and the run was not
   * interrupted. Undefined while the node runs, and for a node that the engine stopped.
   */
  readonly diedAs: () => string | undefined;
  /** Stops the node and everything in its process group, and resolves when they are gone. */
  readonly stop: () => Promise<void>;
};

////////////////////////////////////////////////////////////////////////////////
// Which tests get a node
////////////////////////////////////////////////////////////////////////////////

function isNodeChain(chain: Chain): chain is NodeChain {
  return chain.runtime === 'anvil' || chain.runtime === 'hardhat-node';
}

function nodeChainsStartedBy(test: Test, startedBy: NodeChain['startedBy']): readonly NodeChain[] {
  return test.chains.filter(isNodeChain).filter((chain) => chain.startedBy === startedBy);
}

/** True when the engine starts a node for the test. */
export function needsRunnerNode(test: Test): boolean {
  return nodeChainsStartedBy(test, 'runner').length > 0;
}

/** True when the test starts a node of its own. The engine starts none for it: see `nodeOfATestThatStartsItsOwn`. */
export function startsItsOwnNode(test: Test): boolean {
  return nodeChainsStartedBy(test, 'test').length > 0;
}

/**
 * The chain of a test whose node the engine starts, if any. A test gets one node at most: the engine
 * tells a command where one node is, not several.
 */
export function runnerNodeChain(test: Test): NodeChain | undefined {
  const chains = nodeChainsStartedBy(test, 'runner');

  if (chains.length > 1) {
    throw new TestEngineError(
      `The test has ${chains.length} chains with "startedBy": "runner", and the engine gives a test one node at most.`,
    );
  }

  return chains[0];
}

////////////////////////////////////////////////////////////////////////////////
// Starting
////////////////////////////////////////////////////////////////////////////////

export type StartNodeInput = {
  readonly chain: NodeChain;
  /** The directory the node starts from. */
  readonly root: string;
  /** The log of the test the node is for: it gets what the engine says about the node. */
  readonly log: TestLog;
  /** The log of the node itself: it gets the output of the node, apart from the test's. */
  readonly nodeLog: NodeLog;
  readonly interruption: AbortSignal;
  /** Gives the port of a node whose chain states 0. Default: a free port. Only a unit test gives another. */
  readonly pickPort?: ((host: string) => Promise<number>) | undefined;
};

/**
 * Starts a new node for one test, in a process group of its own, with a GUID of its own in its
 * environment, and resolves once the node answers with the chain id of the chain. A node that does not
 * come up is stopped, and the error says why.
 */
export async function startNode(input: StartNodeInput): Promise<RunningNode> {
  const { chain, log, interruption } = input;
  const guid = newGuid();
  const port = await portOfNode(input);
  const url = `http://${NODE_HOST}:${port}`;
  const command = NODE_COMMANDS[chain.runtime]({ port, chainId: chain.chainid });

  log.line(`Node ${guid}, for chain ${chain.chainid}: $ ${command}`);

  const node = watchNode({
    interruption,
    process: startInGroup({
      command,
      cwd: input.root,
      env: { ...environmentWithoutGuid(), [GUID_VARIABLE]: guid },
      onStream: input.nodeLog.attach,
      interruption,
    }),
  });

  try {
    await nodeAnswers({ url, port, guid, chainId: chain.chainid, endedAs: node.endedAs, interruption });
  } catch (error) {
    await node.stop();

    throw error;
  }

  log.line(`Node ${guid} answers at ${url}.`);

  return { guid, url, port, diedAs: node.diedAs, stop: node.stop };
}

/**
 * The port of the node of a chain. A fixed port is the one the chain states: the engine never replaces
 * it with another. A chain that states 0 leaves the choice to the system, and only then does the engine
 * ask the system for a free port.
 */
async function portOfNode(input: Pick<StartNodeInput, 'chain' | 'pickPort'>): Promise<number> {
  const { chain } = input;

  if (chain.port === undefined) throw new TestEngineError('The chain states no port for its node.');

  const [port, ...others] = portsOfSpec(chain.port);

  if (port === undefined || others.length > 0) {
    throw new TestEngineError(`The chain states the ports '${chain.port}', and the engine starts one node for it.`);
  }

  return isFixedPort(port) ? port : (input.pickPort ?? freePort)(NODE_HOST);
}

type WatchNodeInput = {
  readonly process: GroupProcess;
  readonly interruption: AbortSignal;
};

type WatchedNode = Pick<RunningNode, 'diedAs' | 'stop'> & {
  /** How the node's own process ended, whoever ended it. Undefined while it runs. */
  readonly endedAs: () => string | undefined;
};

/** Follows the process of a node, to tell a node that died from a node that the engine stopped. */
function watchNode(input: WatchNodeInput): WatchedNode {
  let endedAs: string | undefined;
  let diedAs: string | undefined;
  let stopRequested = false;

  void input.process.exited.then((exit) => {
    endedAs = describeExit({ exit, subject: 'The node' });

    // The engine stops the node itself on request and on an interruption: that is not a death.
    if (!stopRequested && !input.interruption.aborted) diedAs = endedAs;
  });

  return {
    endedAs: () => endedAs,
    diedAs: () => diedAs,
    stop: () => {
      stopRequested = true;

      return input.process.stop();
    },
  };
}

type NodeAnswersInput = {
  readonly url: string;
  readonly port: number;
  readonly guid: string;
  readonly chainId: number;
  /** How the node's own process ended, or undefined while it runs. */
  readonly endedAs: () => string | undefined;
  readonly interruption: AbortSignal;
};

/**
 * Resolves once a node answers at the URL, the process that listens there carries the GUID of the
 * node, and the answer is the expected chain id. Rejects with the reason otherwise.
 *
 * An answer alone is not enough. When another process took the port first, the engine's node cannot
 * start, and that other process answers in its place. So the engine accepts a node only when it is
 * its own process that listens on the port.
 */
async function nodeAnswers(input: NodeAnswersInput): Promise<void> {
  const { url, port, guid } = input;
  const deadline = performance.now() + READY_LIMIT_MILLISECONDS;
  let answersSince: number | undefined;

  for (;;) {
    const answers = (await ethChainId(url)) !== undefined;
    const listener = answers ? await portListener({ port, guid }) : undefined;
    const endedAs = input.endedAs();

    if (input.interruption.aborted) throw new TestEngineError('The node was stopped before it came up.');

    if (endedAs !== undefined) throw new TestEngineError(`The node did not come up. ${endedAs}`);

    if (listener === 'another-process') {
      throw new TestEngineError(`Another process listens on port ${port}, and answers in the place of the node.`);
    }

    // The chain id is asked again, now that the node on the port is known to be the engine's own.
    if (listener === 'the-node') return requireChainId({ answered: await ethChainId(url), expected: input.chainId });

    answersSince = answers ? (answersSince ?? performance.now()) : undefined;

    if (answersSince !== undefined && performance.now() - answersSince >= LISTENER_LIMIT_MILLISECONDS) {
      throw new TestEngineError(
        `A node answers at ${url}, and the engine could not check that the process that listens on port ${port} ` +
          `carries the GUID of the node. The engine reads that from the system, which gave no answer.`,
      );
    }

    if (performance.now() >= deadline) {
      throw new TestEngineError(`The node did not answer at ${url} within ${READY_LIMIT_MILLISECONDS / 1000}s.`);
    }

    await sleep(READY_POLL_MILLISECONDS);
  }
}

type RequireChainIdInput = {
  readonly answered: number | undefined;
  readonly expected: number;
};

function requireChainId(input: RequireChainIdInput): void {
  if (input.answered !== input.expected) {
    throw new TestEngineError(
      `The node answers with chain id ${String(input.answered)}, and the test needs chain id ${input.expected}.`,
    );
  }
}
