'use client';
/**
 * EN: Optional wallet linking via EIP-1193 + SIWE, with plain-language explanations.
 * ES: Vinculación opcional de wallet vía EIP-1193 + SIWE, con explicaciones en lenguaje simple.
 * EN: Signing a SIWE message costs no gas and moves no funds; local/Sepolia only.
 * ES: Firmar un mensaje SIWE no cuesta gas ni mueve fondos; solo local/Sepolia.
 */
/**
 * EN: Optional wallet linking via SIWE using the injected EIP-1193 provider. Each step shows a
 *     plain-language explanation BEFORE the wallet prompt. Only local Anvil / Sepolia chain ids.
 * ES: Vinculación opcional de wallet vía SIWE con el proveedor EIP-1193 inyectado. Cada paso
 *     muestra una explicación simple ANTES del pedido de la wallet. Solo Anvil local / Sepolia.
 */
import { useState } from 'react';
import { EXPLANATIONS, explainError, type WalletAction } from '@palooza/web3/explain';
import { SUPPORTED_CHAINS } from '@palooza/web3/chains';
import { api, ApiError } from '@/lib/api';
import { useApp } from '@/lib/session';

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

// EN: Build the EIP-4361 text client-side; the server re-parses and checks domain/nonce/chain.
// ES: Arma el texto EIP-4361 en el cliente; el servidor lo re-parsea y verifica dominio/nonce/cadena.
function siweText(o: { domain: string; address: string; uri: string; chainId: number; nonce: string }) {
  const now = new Date();
  return `${o.domain} wants you to sign in with your Ethereum account:\n${o.address}\n\nLink this wallet to my Palooza account\n\nURI: ${o.uri}\nVersion: 1\nChain ID: ${o.chainId}\nNonce: ${o.nonce}\nIssued At: ${now.toISOString()}\nExpiration Time: ${new Date(now.getTime() + 5 * 60_000).toISOString()}`;
}

// EN: `Wallet` — see file header for its role in the flow.
// ES: `Wallet` — ver encabezado del archivo para su papel en el flujo.
export default function Wallet() {
  const { t, user, locale, refresh } = useApp();
  const [step, setStep] = useState<WalletAction>('connect');
  const [addr, setAddr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const eth = typeof window !== 'undefined' ? (window as unknown as { ethereum?: Eth }).ethereum : undefined;
  const ex = EXPLANATIONS[step][locale];

  const connect = async () => {
    try {
      const [a] = (await eth!.request({ method: 'eth_requestAccounts' })) as string[];
      setAddr(a ?? null);
      setStep('siwe');
    } catch (e) {
      setMsg(explainError(e, locale));
    }
  };
  const link = async () => {
    try {
      const chainId = parseInt(String(await eth!.request({ method: 'eth_chainId' })), 16);
      if (!SUPPORTED_CHAINS[chainId]) return setMsg(t('wallet.testnet'));
      const { nonce, domain, uri } = await api<{ nonce: string; domain: string; uri: string }>('/wallet/nonce', { method: 'POST' });
      const message = siweText({ domain, address: addr!, uri, chainId, nonce });
      const signature = await eth!.request({ method: 'personal_sign', params: [message, addr] });
      await api('/wallet/link', { method: 'POST', body: { message, signature } });
      await refresh();
      setMsg(null);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.code : explainError(e, locale));
    }
  };

  if (!user) return <p>{t('game.loginNeeded')}</p>;
  return (
    <section className="space-y-4 max-w-lg">
      <h1 className="text-2xl font-bold">{t('wallet.title')}</h1>
      <p className="text-xs text-zap">{t('wallet.testnet')}</p>
      {user.wallet ? (
        <p>{t('wallet.linked')}: <span className="mono">{user.wallet}</span></p>
      ) : !eth ? (
        <p className="text-slate-400">{t('wallet.none')}</p>
      ) : (
        <>
          <dl className="panel text-sm space-y-1" aria-label="explanation">
            <dt className="font-semibold">{ex.title}</dt>
            <dd>{ex.whatHappens}</dd>
            <dd>💸 {ex.cost}</dd>
            <dd>🔐 {ex.permissions}</dd>
            <dd>⚠️ {ex.risks}</dd>
          </dl>
          {step === 'connect' ? (
            <button className="btn-primary" onClick={() => void connect()}>{t('wallet.connect')}</button>
          ) : (
            <button className="btn-primary" onClick={() => void link()}>{t('wallet.sign')}</button>
          )}
        </>
      )}
      <p role="alert" className="text-bad">{msg}</p>
    </section>
  );
}
