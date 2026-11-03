/**
 * EN: Append-only, hash-chained points ledger. Each record links to the previous record's hash,
 *     so editing or deleting history is detectable. Balances are a cache derived from records,
 *     and `reconcile()` recomputes everything from scratch and reports any mismatch.
 * ES: Libro de puntos append-only y encadenado por hash. Cada registro enlaza al hash del anterior,
 *     así que editar o borrar historia es detectable. Los saldos son una caché derivada de los
 *     registros, y `reconcile()` recalcula todo desde cero e informa cualquier diferencia.
 */
import { createHash } from 'node:crypto';
import { FeatureFlags } from './flags.js';
import { dayKey, matchRules, type RewardEvent, type RewardRule } from './rules.js';

export interface LedgerRecord {
  seq: number;
  userId: string;
  delta: number; // EN: + grant / − adjustment / ES: + otorgamiento / − ajuste
  kind: 'grant' | 'adjustment';
  ruleId?: string;
  ruleVersion?: number;
  ref: string; // EN: source id; (ruleId, ref) is unique / ES: id de origen; (ruleId, ref) es único
  actor: string; // EN: 'system' or admin id / ES: 'system' o id de admin
  reason?: string;
  at: number;
  prevHash: string;
  hash: string;
}

const GENESIS = '0'.repeat(64);

/** EN: Canonical hash of a record body. / ES: Hash canónico del cuerpo de un registro. */
export function hashRecord(r: Omit<LedgerRecord, 'hash'>): string {
  const body = [r.seq, r.userId, r.delta, r.kind, r.ruleId ?? '', r.ruleVersion ?? '', r.ref, r.actor, r.reason ?? '', r.at, r.prevHash].join('|');
  return createHash('sha256').update(body).digest('hex');
}

export class PointsLedger {
  private readonly records: LedgerRecord[] = [];
  private readonly balances = new Map<string, number>();
  private readonly seen = new Set<string>(); // EN: idempotency keys / ES: claves de idempotencia
  private readonly daily = new Map<string, number>(); // EN: user|rule|day → granted / ES: otorgado

  constructor(private rules: RewardRule[], public readonly flags = new FeatureFlags()) {}

  setRules(rules: RewardRule[]): void {
    this.rules = rules;
  }

  private append(r: Omit<LedgerRecord, 'seq' | 'prevHash' | 'hash'>): LedgerRecord {
    const prevHash = this.records.at(-1)?.hash ?? GENESIS;
    const base = { ...r, seq: this.records.length, prevHash };
    const rec: LedgerRecord = Object.freeze({ ...base, hash: hashRecord(base) });
    this.records.push(rec);
    this.balances.set(r.userId, (this.balances.get(r.userId) ?? 0) + r.delta);
    return rec;
  }

  /**
   * EN: Process an event: apply matching rules with daily caps; idempotent on (rule, ref).
   * ES: Procesa un evento: aplica reglas con topes diarios; idempotente por (regla, ref).
   */
  process(ev: RewardEvent): LedgerRecord[] {
    const out: LedgerRecord[] = [];
    for (const rule of matchRules(ev, this.rules)) {
      const key = `${rule.id}|${ev.ref}`;
      if (this.seen.has(key)) continue;
      const dk = `${ev.userId}|${rule.id}|${dayKey(ev.at)}`;
      const used = this.daily.get(dk) ?? 0;
      const grant = rule.dailyCap === undefined ? rule.points : Math.min(rule.points, rule.dailyCap - used);
      this.seen.add(key);
      if (grant <= 0) continue;
      this.daily.set(dk, used + grant);
      out.push(this.append({ userId: ev.userId, delta: grant, kind: 'grant', ruleId: rule.id, ruleVersion: rule.version, ref: ev.ref, actor: 'system', at: ev.at }));
    }
    return out;
  }

  /**
   * EN: Admin adjustment (requires a reason; cannot push a balance below zero). Corrections are new
   *     records, never edits.
   * ES: Ajuste de admin (requiere motivo; no puede dejar un saldo negativo). Las correcciones son
   *     registros nuevos, nunca ediciones.
   */
  adjust(userId: string, delta: number, actor: string, reason: string, at = Date.now()): LedgerRecord {
    if (!reason || reason.trim().length < 5) throw new Error('reason_required');
    if (!Number.isInteger(delta) || delta === 0) throw new Error('bad_delta');
    if (this.balance(userId) + delta < 0) throw new Error('negative_balance');
    return this.append({ userId, delta, kind: 'adjustment', ref: `adj:${this.records.length}`, actor, reason, at });
  }

  /** EN: Real-value conversion is gated and unimplemented. / ES: La conversión a valor real tiene compuerta y no está implementada. */
  redeemForValue(_userId: string, _points: number): never {
    this.flags.require('token_rewards');
    throw new Error('unreachable');
  }

  balance(userId: string): number {
    return this.balances.get(userId) ?? 0;
  }

  history(userId?: string): readonly LedgerRecord[] {
    return userId ? this.records.filter((r) => r.userId === userId) : this.records.slice();
  }

  /**
   * EN: Reconciliation: verify the chain and recompute balances. Returns problems (empty = clean).
   * ES: Conciliación: verifica la cadena y recalcula saldos. Devuelve problemas (vacío = limpio).
   */
  reconcile(records: readonly LedgerRecord[] = this.records): { ok: boolean; problems: string[]; totals: Record<string, number> } {
    const problems: string[] = [];
    const totals: Record<string, number> = {};
    let prev = GENESIS;
    const keys = new Set<string>();
    records.forEach((r, i) => {
      if (r.seq !== i) problems.push(`seq_gap@${i}`);
      if (r.prevHash !== prev) problems.push(`chain_break@${i}`);
      const { hash, ...body } = r;
      if (hashRecord(body) !== hash) problems.push(`hash_mismatch@${i}`);
      if (r.kind === 'grant') {
        const k = `${r.ruleId}|${r.ref}`;
        if (keys.has(k)) problems.push(`duplicate_grant@${i}`);
        keys.add(k);
      }
      totals[r.userId] = (totals[r.userId] ?? 0) + r.delta;
      prev = hash;
    });
    for (const [u, b] of this.balances) if ((totals[u] ?? 0) !== b && records === this.records) problems.push(`balance_mismatch:${u}`);
    return { ok: problems.length === 0, problems, totals };
  }

  /** EN: Test hook to simulate cache corruption. / ES: Hook de test para simular corrupción de caché. */
  _corruptBalance(userId: string, v: number): void {
    this.balances.set(userId, v);
  }
}
