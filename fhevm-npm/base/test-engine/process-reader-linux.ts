import { readFileSync, readdirSync, readlinkSync } from 'node:fs';

import { engineGuidAmong } from './guid.ts';
import type { ProcessReader } from './process-reader.ts';

/** The state of a listening socket in /proc/net/tcp. */
const LISTEN_STATE = '0A';

/** Linux gives every answer as files of the /proc file system, so nothing here waits. */
export const LINUX_READER: ProcessReader = {
  list: async () => {
    return pids().flatMap((pid) => {
      const guid = guidOf(pid);
      const groupId = guid === undefined ? undefined : groupIdOf(pid);

      return guid === undefined || groupId === undefined ? [] : [{ pid, groupId, guid }];
    });
  },
  guidOf: async (pid) => guidOf(pid),
  listenersOn: async (port) => listenersOn(port),
};

function pids(): readonly number[] {
  return readdirSync('/proc')
    .filter((name) => /^\d+$/.test(name))
    .map(Number);
}

/** Reads the environment that the kernel keeps for a process. A process of another user, or one that is gone, has none to read. */
function guidOf(pid: number): string | undefined {
  try {
    return engineGuidAmong(readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0'));
  } catch {
    return undefined;
  }
}

function groupIdOf(pid: number): number | undefined {
  try {
    // The fields after the command name, which is in parentheses and can hold spaces: state, parent, group.
    const afterName = readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').pop() ?? '';
    const groupId = Number(afterName.split(' ')[2]);

    return Number.isInteger(groupId) && groupId > 0 ? groupId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The processes that hold a listening socket of the port. The kernel lists its TCP sockets in
 * /proc/net/tcp and /proc/net/tcp6, each with its local port, its state and its inode, and lists the
 * sockets of a process as links named `socket:[<inode>]` in /proc/<pid>/fd.
 */
function listenersOn(port: number): readonly number[] {
  const inodes = new Set(['/proc/net/tcp', '/proc/net/tcp6'].flatMap((table) => listeningInodes({ table, port })));

  if (inodes.size === 0) return [];

  return pids().filter((pid) => socketInodesOf(pid).some((inode) => inodes.has(inode)));
}

type ListeningInodesInput = {
  readonly table: string;
  readonly port: number;
};

function listeningInodes(input: ListeningInodesInput): readonly string[] {
  let lines: readonly string[];

  try {
    lines = readFileSync(input.table, 'utf8').split('\n').slice(1);
  } catch {
    // A system without IPv6 has no tcp6 table.
    return [];
  }

  return lines.flatMap((line) => {
    // The columns: sl, local_address, rem_address, st, tx:rx queues, tr:when, retrnsmt, uid, timeout, inode.
    const columns = line.trim().split(/\s+/);
    const localPort = Number.parseInt(columns[1]?.split(':').pop() ?? '', 16);
    const inode = columns[9];

    return localPort === input.port && columns[3] === LISTEN_STATE && inode !== undefined ? [inode] : [];
  });
}

/** The inodes of the sockets that a process holds. A process of another user, or one that is gone, shows none. */
function socketInodesOf(pid: number): readonly string[] {
  try {
    return readdirSync(`/proc/${pid}/fd`).flatMap((descriptor) => {
      const inode = /^socket:\[(\d+)\]$/.exec(linkTarget(`/proc/${pid}/fd/${descriptor}`))?.[1];

      return inode === undefined ? [] : [inode];
    });
  } catch {
    return [];
  }
}

function linkTarget(path: string): string {
  try {
    return readlinkSync(path);
  } catch {
    return '';
  }
}
