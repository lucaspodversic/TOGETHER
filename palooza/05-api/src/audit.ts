/**
 * EN: Append-only, hash-chained audit log for security-relevant actions (logins, admin actions,
 *     wallet links, flag changes). Details are redacted before storage.
 * ES: Log de auditoría append-only y encadenado por hash para acciones sensibles (logins, acciones
 *     de admin, vinculación de wallets, cambios de flags). Los detalles se redactan antes de guardar.
 */
import { createHash } from 'node:crypto';
import { redact } from '@palooza/identity';

export interface AuditEntry { seq: number; at: string; actor: string; action: string; target?: string; details?: unknown; prevHash: string; hash: string }

export class AuditLog {
  private readonly entries: AuditEntry[] = [];

  record(actor: string, action: string, target?: string, details?: unknown): AuditEntry {
    const prevHash = this.entries.at(-1)?.hash ?? '0'.repeat(64);
    const base = { seq: this.entries.length, at: new Date().toISOString(), actor, action, target, details: details === undefined ? undefined : redact(details), prevHash };
    const hash = createHash('sha256').update(JSON.stringify(base)).digest('hex');
    const e = Object.freeze({ ...base, hash });
    this.entries.push(e);
    return e;
  }

  list(limit = 100): AuditEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  /** EN: Verify the whole chain. / ES: Verifica toda la cadena. */
  verify(): boolean {
    let prev = '0'.repeat(64);
    return this.entries.every((e) => {
      const { hash, ...base } = e;
      const ok = e.prevHash === prev && createHash('sha256').update(JSON.stringify(base)).digest('hex') === hash;
      prev = hash;
      return ok;
    });
  }
}
