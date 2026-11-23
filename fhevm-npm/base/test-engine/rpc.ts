/** How long one call to a node may take. */
const CALL_LIMIT_MILLISECONDS = 2_000;

/**
 * Asks a node for its chain id with `eth_chainId`. Returns undefined when the node gives no valid
 * answer in time: it is not up. A process that exists can still be starting, or be hung, so this call
 * is the only way the engine learns that a node is up.
 */
export async function ethChainId(url: string): Promise<number | undefined> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(CALL_LIMIT_MILLISECONDS),
    });
    const answer: unknown = await response.json();
    const result = typeof answer === 'object' && answer !== null && 'result' in answer ? answer.result : undefined;

    return typeof result === 'string' && /^0x[0-9a-f]+$/i.test(result) ? Number.parseInt(result, 16) : undefined;
  } catch {
    return undefined;
  }
}
