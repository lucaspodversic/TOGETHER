// EN: SIWE, chain allow-list, tx monitor and copy tests. / ES: Tests de SIWE, cadenas, monitor de tx y textos.
import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { EXPLANATIONS, NonceStore, TxMonitor, assertSupportedChain, buildSiweMessage, explainError, parseSiweMessage, verifySiwe, type ChainReader } from '../src/index.js';

// EN: Well-known anvil test key #0 (public, test-only). / ES: Clave de prueba #0 de anvil (pública, solo test).
const acct = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const NOW = Date.parse('2026-11-02T12:00:00Z');

function msg(nonce: string, over: Partial<Parameters<typeof buildSiweMessage>[0]> = {}) {
  return buildSiweMessage({ domain: '127.0.0.1:3000', address: acct.address, statement: 'Link wallet to Palooza', uri: 'http://127.0.0.1:3000', version: '1', chainId: 31337, nonce, issuedAt: new Date(NOW).toISOString(), expirationTime: new Date(NOW + 300_000).toISOString(), ...over });
}

// EN: Suite: siwe.
// ES: Suite: siwe.
describe('siwe', () => {
  // EN: Case — build/parse round trip.
  // ES: Caso — ida y vuelta.
  it('build/parse round trip / ida y vuelta', () => {
    const p = parseSiweMessage(msg('abc12345'));
    expect(p).toMatchObject({ domain: '127.0.0.1:3000', chainId: 31337, nonce: 'abc12345' });
  });
  // EN: Case — verifies a real signature.
  // ES: Caso — verifica una firma real.
  it('verifies a real signature / verifica una firma real', async () => {
    const ns = new NonceStore();
    const nonce = ns.issue('u1', NOW);
    const m = msg(nonce);
    const sig = await acct.signMessage({ message: m });
    expect(await verifySiwe(m, sig, { expectedDomain: '127.0.0.1:3000', nonces: ns, userId: 'u1', now: NOW })).toBe(acct.address);
  });
  // EN: Case — nonce is single use.
  // ES: Caso — nonce de un solo uso.
  it('nonce is single use / nonce de un solo uso', async () => {
    const ns = new NonceStore();
    const nonce = ns.issue('u1', NOW);
    const m = msg(nonce);
    const sig = await acct.signMessage({ message: m });
    await verifySiwe(m, sig, { expectedDomain: '127.0.0.1:3000', nonces: ns, userId: 'u1', now: NOW });
    await expect(verifySiwe(m, sig, { expectedDomain: '127.0.0.1:3000', nonces: ns, userId: 'u1', now: NOW })).rejects.toThrow('siwe_nonce');
  });
  // EN: Case — nonce bound to user.
  // ES: Caso — nonce ligado al usuario.
  it('nonce bound to user / nonce ligado al usuario', async () => {
    const ns = new NonceStore();
    const m = msg(ns.issue('u1', NOW));
    await expect(verifySiwe(m, await acct.signMessage({ message: m }), { expectedDomain: '127.0.0.1:3000', nonces: ns, userId: 'u2', now: NOW })).rejects.toThrow('siwe_nonce');
  });
  // EN: Case — rejects wrong domain.
  // ES: Caso — rechaza dominio incorrecto.
  it('rejects wrong domain / rechaza dominio incorrecto', async () => {
    const ns = new NonceStore();
    const m = msg(ns.issue('u1', NOW), { domain: 'evil.example' });
    await expect(verifySiwe(m, await acct.signMessage({ message: m }), { expectedDomain: '127.0.0.1:3000', nonces: ns, userId: 'u1', now: NOW })).rejects.toThrow('siwe_domain');
  });
  // EN: Case — rejects mainnet.
  // ES: Caso — rechaza mainnet.
  it('rejects mainnet / rechaza mainnet', async () => {
    const ns = new NonceStore();
    const m = msg(ns.issue('u1', NOW), { chainId: 1 });
    await expect(verifySiwe(m, await acct.signMessage({ message: m }), { expectedDomain: '127.0.0.1:3000', nonces: ns, userId: 'u1', now: NOW })).rejects.toThrow('unsupported_chain');
  });
  // EN: Case — rejects expired.
  // ES: Caso — rechaza vencido.
  it('rejects expired / rechaza vencido', async () => {
    const ns = new NonceStore();
    const m = msg(ns.issue('u1', NOW), { expirationTime: new Date(NOW - 1).toISOString() });
    await expect(verifySiwe(m, await acct.signMessage({ message: m }), { expectedDomain: '127.0.0.1:3000', nonces: ns, userId: 'u1', now: NOW })).rejects.toThrow('siwe_expired');
  });
  // EN: Case — rejects forged signature.
  // ES: Caso — rechaza firma falsificada.
  it('rejects forged signature / rechaza firma falsificada', async () => {
    const ns = new NonceStore();
    const nonce = ns.issue('u1', NOW);
    const m = msg(nonce);
    const sig = await acct.signMessage({ message: m + 'x' });
    await expect(verifySiwe(m, sig, { expectedDomain: '127.0.0.1:3000', nonces: ns, userId: 'u1', now: NOW })).rejects.toThrow('siwe_signature');
  });
  // EN: Case — rejects malformed.
  // ES: Caso — rechaza malformado.
  it('rejects malformed / rechaza malformado', () => expect(() => parseSiweMessage('hello')).toThrow('siwe_malformed'));
});

// EN: Suite: chains.
// ES: Suite: cadenas.
describe('chains / cadenas', () => {
  // EN: Case — anvil + sepolia only.
  // ES: Caso — solo anvil + sepolia.
  it('anvil + sepolia only / solo anvil + sepolia', () => {
    expect(assertSupportedChain(31337).confirmations).toBe(1);
    expect(assertSupportedChain(11155111).name).toBe('Sepolia');
    expect(() => assertSupportedChain(1)).toThrow();
  });
});

// EN: Scriptable fake chain. / ES: Cadena falsa programable.
function fakeChain() {
  const st = { head: 100n, receipts: new Map<string, { blockNumber: bigint; status: 'success' | 'reverted' }>(), mempool: new Set<string>() };
  const reader: ChainReader = { blockNumber: async () => st.head, receipt: async (h) => st.receipts.get(h) ?? null, known: async (h) => st.mempool.has(h) || st.receipts.has(h) };
  return { st, reader };
}

// EN: Suite: tx monitor.
// ES: Suite: tx monitor.
describe('tx monitor', () => {
  // EN: Case — pending → confirming → confirmed.
  // ES: Caso — pending → confirming → confirmed.
  it('pending → confirming → confirmed', async () => {
    const { st, reader } = fakeChain();
    const m = new TxMonitor(reader, 3);
    m.track('0xa', 0);
    st.mempool.add('0xa');
    await m.poll(1);
    expect(m.get('0xa')!.state).toBe('pending');
    st.receipts.set('0xa', { blockNumber: 101n, status: 'success' });
    st.head = 101n;
    await m.poll(2);
    expect(m.get('0xa')).toMatchObject({ state: 'confirming', confirmations: 1 });
    st.head = 103n;
    const changed = await m.poll(3);
    expect(changed[0]).toMatchObject({ state: 'confirmed', confirmations: 3 });
  });
  // EN: Case — reverted → failed.
  // ES: Caso — reverted → failed.
  it('reverted → failed', async () => {
    const { st, reader } = fakeChain();
    const m = new TxMonitor(reader);
    m.track('0xb');
    st.receipts.set('0xb', { blockNumber: 100n, status: 'reverted' });
    await m.poll();
    expect(m.get('0xb')!.state).toBe('failed');
  });
  // EN: Case — reorg returns to pending.
  // ES: Caso — reorg vuelve a pending.
  it('reorg returns to pending / reorg vuelve a pending', async () => {
    const { st, reader } = fakeChain();
    const m = new TxMonitor(reader, 3);
    m.track('0xc');
    st.receipts.set('0xc', { blockNumber: 100n, status: 'success' });
    await m.poll();
    st.receipts.delete('0xc');
    st.mempool.add('0xc');
    await m.poll();
    expect(m.get('0xc')).toMatchObject({ state: 'pending', confirmations: 0 });
  });
  // EN: Case — dropped after timeout.
  // ES: Caso — descartada tras timeout.
  it('dropped after timeout / descartada tras timeout', async () => {
    const { reader } = fakeChain();
    const m = new TxMonitor(reader, 3, 1000);
    m.track('0xd', 0);
    await m.poll(10);
    expect(m.get('0xd')!.state).toBe('submitted');
    await m.poll(2000);
    expect(m.get('0xd')!.state).toBe('dropped');
  });
});

// EN: Suite: explanations.
// ES: Suite: explicaciones.
describe('explanations / explicaciones', () => {
  // EN: Case — every action has EN+ES.
  // ES: Caso — cada acción tiene EN+ES.
  it('every action has EN+ES / cada acción tiene EN+ES', () => {
    for (const e of Object.values(EXPLANATIONS)) {
      expect(e.en.cost.length).toBeGreaterThan(0);
      expect(e.es.cost.length).toBeGreaterThan(0);
    }
    expect(EXPLANATIONS.siwe.en.cost).toMatch(/no gas/i);
  });
  // EN: Case — maps errors.
  // ES: Caso — traduce errores.
  it('maps errors / traduce errores', () => {
    expect(explainError(new Error('User rejected the request'), 'es')).toMatch(/Cancelaste/);
    expect(explainError({ message: 'insufficient funds' })).toMatch(/faucet/);
    expect(explainError('weird')).toMatch(/Nothing was charged/);
  });
});
