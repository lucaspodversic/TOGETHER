/**
 * EN: Integration test against a local anvil node; skipped if anvil/forge output are absent.
 * ES: Test de integración contra un nodo anvil local; se omite si faltan anvil o la salida de forge.
 * EN: Never touches a public RPC.
 * ES: Nunca toca un RPC público.
 */
// EN: Optional integration test: deploys PaloozaBadges on a throwaway local anvil and drives TxMonitor.
//     Skipped automatically when anvil or the forge build output are missing.
// ES: Test de integración opcional: despliega PaloozaBadges en un anvil local descartable y usa TxMonitor.
//     Se saltea solo si faltan anvil o la salida de forge build.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { TxMonitor, paloozaBadgesAbi } from '../src/index.js';

const ART = new URL('../contracts/out/PaloozaBadges.sol/PaloozaBadges.json', import.meta.url);
const hasAnvil = spawnSync('anvil', ['--version']).status === 0;
const PORT = 18545 + Math.floor(Math.random() * 1000);
const RPC = `http://127.0.0.1:${PORT}`;
let node: ChildProcess | undefined;

describe.skipIf(!hasAnvil || !existsSync(ART))('anvil integration / integración con anvil', () => {
  beforeAll(async () => {
    node = spawn('anvil', ['--host', '127.0.0.1', '--port', String(PORT), '--silent'], { stdio: 'ignore' });
    const pub = createPublicClient({ chain: foundry, transport: http(RPC) });
    // EN: Wait until the node answers. / ES: Esperar a que el nodo responda.
    for (let i = 0; i < 50; i++) {
      try { await pub.getBlockNumber(); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    throw new Error('anvil did not start');
  });
  afterAll(() => node?.kill());

  // EN: Case — deploys, mints a soulbound badge and confirms.
  // ES: Caso — despliega, mintea y confirma.
  it('deploys, mints a soulbound badge and confirms / despliega, mintea y confirma', async () => {
    const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
    const wallet = createWalletClient({ account, chain: foundry, transport: http(RPC) });
    const pub = createPublicClient({ chain: foundry, transport: http(RPC) });
    const art = JSON.parse(readFileSync(ART, 'utf8'));
    const deployHash = await wallet.deployContract({ abi: art.abi, bytecode: art.bytecode.object as Hex, args: [account.address] });
    const { contractAddress } = await pub.waitForTransactionReceipt({ hash: deployHash });
    const address = contractAddress!;
    await pub.waitForTransactionReceipt({ hash: await wallet.writeContract({ address, abi: paloozaBadgesAbi, functionName: 'setMinter', args: [account.address, true] }) });
    await pub.waitForTransactionReceipt({ hash: await wallet.writeContract({ address, abi: paloozaBadgesAbi, functionName: 'registerBadge', args: [1n, 'palooza://badge/first_game'] }) });
    const mintHash = await wallet.writeContract({ address, abi: paloozaBadgesAbi, functionName: 'mint', args: ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 1n] });
    const monitor = new TxMonitor({
      blockNumber: () => pub.getBlockNumber(),
      receipt: async (h) => { try { const r = await pub.getTransactionReceipt({ hash: h as Hex }); return { blockNumber: r.blockNumber, status: r.status }; } catch { return null; } },
      known: async (h) => { try { await pub.getTransaction({ hash: h as Hex }); return true; } catch { return false; } },
    }, 1);
    monitor.track(mintHash);
    await pub.waitForTransactionReceipt({ hash: mintHash });
    await monitor.poll();
    expect(monitor.get(mintHash)!.state).toBe('confirmed');
    expect(await pub.readContract({ address, abi: paloozaBadgesAbi, functionName: 'balanceOf', args: ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8', 1n] })).toBe(1n);
  }, 30_000);
});
