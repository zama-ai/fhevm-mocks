/** Seconds since the Unix epoch, the unit decryption permits are dated in. */
export function timestampNow(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * How far in the past a decryption permit starts, in seconds.
 *
 * The permit is checked against the timestamp of the latest block, not against the wall clock. A node
 * whose latest block is a second or two old rejects a permit that starts at the wall-clock second.
 */
export const PERMIT_START_MARGIN_SECONDS = 3;
