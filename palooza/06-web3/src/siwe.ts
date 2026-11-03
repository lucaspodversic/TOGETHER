/**
 * EN: Sign-In with Ethereum (EIP-4361) wallet linking. The server issues a one-time nonce, the
 *     wallet signs a human-readable message (free, no transaction, no gas), and the server verifies
 *     the signature, domain, chain, nonce and expiry before linking the address to the account.
 * ES: Vinculación de wallet con Sign-In with Ethereum (EIP-4361). El servidor emite un nonce de un
 *     solo uso, la wallet firma un mensaje legible (gratis, sin transacción, sin gas) y el servidor
 *     verifica firma, dominio, cadena, nonce y expiración antes de vincular la dirección a la cuenta.
 */
import { getAddress, isAddress, verifyMessage, type Hex } from 'viem';
import { assertSupportedChain } from './chains.js';

export interface SiweFields {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: '1';
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}

/** EN: Build the exact EIP-4361 text. / ES: Construye el texto exacto EIP-4361. */
export function buildSiweMessage(f: SiweFields): string {
  return [
    `${f.domain} wants you to sign in with your Ethereum account:`,
    getAddress(f.address),
    '',
    f.statement,
    '',
    `URI: ${f.uri}`,
    `Version: ${f.version}`,
    `Chain ID: ${f.chainId}`,
    `Nonce: ${f.nonce}`,
    `Issued At: ${f.issuedAt}`,
    `Expiration Time: ${f.expirationTime}`,
  ].join('\n');
}

/** EN: Parse the text back into fields (strict). / ES: Parsea el texto de vuelta a campos (estricto). */
export function parseSiweMessage(msg: string): SiweFields {
  const lines = msg.split('\n');
  const head = /^(.+) wants you to sign in with your Ethereum account:$/.exec(lines[0] ?? '');
  if (!head || !isAddress(lines[1] ?? '')) throw new Error('siwe_malformed');
  const get = (k: string) => {
    const l = lines.find((x) => x.startsWith(`${k}: `));
    if (!l) throw new Error(`siwe_missing:${k}`);
    return l.slice(k.length + 2);
  };
  return {
    domain: head[1]!,
    address: lines[1]!,
    statement: lines[3] ?? '',
    uri: get('URI'),
    version: get('Version') as '1',
    chainId: Number(get('Chain ID')),
    nonce: get('Nonce'),
    issuedAt: get('Issued At'),
    expirationTime: get('Expiration Time'),
  };
}

/** EN: One-time nonces bound to a user, short TTL. / ES: Nonces de un uso ligados a un usuario, TTL corto. */
export class NonceStore {
  private readonly nonces = new Map<string, { userId: string; exp: number }>();
  constructor(private readonly ttlMs = 5 * 60_000) {}
  issue(userId: string, now = Date.now()): string {
    // EN: 128-bit alphanumeric (EIP-4361 requires ≥ 8 alphanumerics). / ES: 128 bits alfanuméricos.
    const nonce = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    this.nonces.set(nonce, { userId, exp: now + this.ttlMs });
    return nonce;
  }
  consume(nonce: string, userId: string, now = Date.now()): boolean {
    const n = this.nonces.get(nonce);
    this.nonces.delete(nonce);
    return !!n && n.userId === userId && n.exp > now;
  }
}

export interface VerifyOptions { expectedDomain: string; nonces: NonceStore; userId: string; now?: number }

/**
 * EN: Full verification. Returns the checksummed address or throws a specific error code.
 * ES: Verificación completa. Devuelve la dirección con checksum o lanza un código de error específico.
 */
export async function verifySiwe(message: string, signature: Hex, o: VerifyOptions): Promise<string> {
  const f = parseSiweMessage(message);
  const now = o.now ?? Date.now();
  if (f.domain !== o.expectedDomain) throw new Error('siwe_domain');
  assertSupportedChain(f.chainId);
  if (Date.parse(f.expirationTime) <= now) throw new Error('siwe_expired');
  // EN: Consume the nonce BEFORE the signature check so a failed attempt cannot be retried.
  // ES: Consumir el nonce ANTES de chequear la firma para que un intento fallido no pueda reintentarse.
  if (!o.nonces.consume(f.nonce, o.userId, now)) throw new Error('siwe_nonce');
  const ok = await verifyMessage({ address: getAddress(f.address), message, signature });
  if (!ok) throw new Error('siwe_signature');
  return getAddress(f.address);
}
