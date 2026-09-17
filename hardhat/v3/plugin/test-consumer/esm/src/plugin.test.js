// A real consumer's view: the INSTALLED payload (not the workspace source) on a programmatic hardhat 3
// environment — a connection deploys the cleartext stack, and a value goes through encrypt, an FHE
// operation on the executor, and back through `fhevm.cleartextDb`. Plain JavaScript on purpose — a
// fixture that adds a toolchain stops representing a consumer, so nothing here imports plugin
// internals: the executor ABI below is hand-written, exactly as a consumer would have to write it.

import assert from 'node:assert/strict';
import test from 'node:test';

import plugin, { getHCU } from '@fhevm/hardhat-plugin-v3';
import { createHardhatRuntimeEnvironment } from 'hardhat/hre';
import { createPublicClient, custom, decodeEventLog, encodeFunctionData, isHex, size } from 'viem';

const CONTRACT = '0x1111111111111111111111111111111111111111';
// The localhost stack is deterministic (CREATE from a fixed deployer at nonce 0), so its executor sits
// at a fixed address — the same one `hardhat node -vvv` prints and ZamaConfig compiles in.
const FHEVM_EXECUTOR = '0xe3a9105a3a932253A70F126eb1E3b589C643dD24';
// `FheType.euint32`. The enum is internal to the plugin now, so a consumer spells the id out.
const EUINT32 = 4;

// The two executor fragments this test needs. A consumer either writes these or takes them from
// `@fhevm/host-contracts-cleartext`; the plugin no longer hands out contract ABIs.
const EXECUTOR_ABI = [
  {
    type: 'function',
    name: 'trivialEncrypt',
    inputs: [
      { name: 'pt', type: 'uint256' },
      { name: 'toType', type: 'uint8' },
    ],
    outputs: [{ name: 'result', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'TrivialEncrypt',
    inputs: [
      { name: 'caller', type: 'address', indexed: true },
      { name: 'pt', type: 'uint256', indexed: false },
      { name: 'toType', type: 'uint8', indexed: false },
      { name: 'result', type: 'bytes32', indexed: false },
    ],
    anonymous: false,
  },
];

test('the installed payload exports what it promises', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  assert.equal(typeof getHCU('FheAdd', 'Uint8'), 'number');
  assert.notEqual(hre, undefined);
});

test('a connection deploys the stack and runs an encrypt / decrypt round-trip', async () => {
  const hre = await createHardhatRuntimeEnvironment({ plugins: [plugin] });
  const connection = await hre.network.create();
  try {
    const { fhevm } = connection;
    assert.equal(fhevm.isCleartext, true);
    assert.equal(fhevm.network.chainId, 31337);

    // Encrypt: an input handle bound to a contract and a user, plus its proof.
    const [from] = await connection.provider.request({ method: 'eth_accounts' });
    const { externalEuint32, inputProof } = await fhevm.helpers.encryptUint32({
      value: 7,
      contractAddress: CONTRACT,
      userAddress: from,
    });
    assert.ok(isHex(externalEuint32) && size(externalEuint32) === 32);
    assert.ok(isHex(inputProof) && size(inputProof) > 0);

    // An FHE operation straight on the deployed executor, then its event and its cleartext.
    const data = encodeFunctionData({
      abi: EXECUTOR_ABI,
      functionName: 'trivialEncrypt',
      args: [42n, EUINT32],
    });
    const hash = await connection.provider.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: FHEVM_EXECUTOR, data }],
    });
    const client = createPublicClient({ transport: custom(connection.provider) });
    const receipt = await client.getTransactionReceipt({ hash });
    const [log] = receipt.logs;
    const event = decodeEventLog({ abi: EXECUTOR_ABI, data: log.data, topics: log.topics });
    assert.equal(event.eventName, 'TrivialEncrypt');

    const handle = event.args.result;
    // Byte 30 of a handle is its FHE type id, which is how the plugin narrows a read.
    assert.equal(Number.parseInt(handle.slice(62, 64), 16), EUINT32);

    // `cleartextDb` reads the value with no ACL check: euint32 clears as a `number`.
    assert.equal(await fhevm.cleartextDb.readUint32({ euint32: handle }), 42);

    const hcu = await fhevm.computeTransactionHCU(hash);
    assert.equal(hcu.globalHCU, getHCU('TrivialEncrypt', 'Uint32'));

    // Nobody allowed it: the permissioned path refuses what `cleartextDb` read.
    await assert.rejects(fhevm.helpers.decryptPublicUint32({ euint32: handle }));
  } finally {
    await connection.close();
  }
});
