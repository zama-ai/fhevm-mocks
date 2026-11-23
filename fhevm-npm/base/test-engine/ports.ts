import { createServer } from 'node:net';

/** The ports this engine process already gave to a node. A port is given once, so two nodes of a run never get the same one. */
const givenPorts = new Set<number>();

/**
 * Gives a port for a new node on the given host: one that is free now, by asking the operating system,
 * and that this run gave to no other node. The specification leaves port allocation out, and the
 * instructions of this implementation leave the method to it.
 *
 * A process outside the run can still take the port before the node does. The node then fails to
 * start, and its test is failed, as for any node that cannot start.
 */
export async function freePort(host: string): Promise<number> {
  for (;;) {
    const port = await portFromTheSystem(host);

    if (!givenPorts.has(port)) {
      givenPorts.add(port);

      return port;
    }
  }
}

function portFromTheSystem(host: string): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();

    server.once('error', rejectPort);
    server.listen({ port: 0, host }, () => {
      const address = server.address();

      server.close(() => {
        if (typeof address === 'object' && address !== null) resolvePort(address.port);
        else rejectPort(new Error('The operating system gave no port.'));
      });
    });
  });
}
