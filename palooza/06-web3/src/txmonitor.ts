/**
 * EN: Transaction state monitor. UI-facing states:
 *       submitted → pending (in mempool) → confirming (k/N) → confirmed
 *                                       ↘ failed (reverted) / dropped (vanished) / replaced
 *     A confirmed tx that disappears after a reorg goes back to pending.
 *     The chain is behind an interface so tests (and anvil) can drive it.
 * ES: Monitor de estado de transacciones. Estados para la UI:
 *       submitted → pending (en mempool) → confirming (k/N) → confirmed
 *                                       ↘ failed (revertida) / dropped (desapareció) / replaced
 *     Una tx confirmada que desaparece tras un reorg vuelve a pending.
 *     La cadena está detrás de una interfaz para que los tests (y anvil) la manejen.
 */
export type TxState = 'submitted' | 'pending' | 'confirming' | 'confirmed' | 'failed' | 'dropped';

export interface ChainReader {
  blockNumber(): Promise<bigint>;
  // EN: null when no receipt yet. / ES: null si aún no hay recibo.
  receipt(hash: string): Promise<{ blockNumber: bigint; status: 'success' | 'reverted' } | null>;
  // EN: true if the node still knows the tx (mempool or mined). / ES: true si el nodo aún conoce la tx.
  known(hash: string): Promise<boolean>;
}

export interface TrackedTx {
  hash: string;
  state: TxState;
  confirmations: number;
  required: number;
  firstSeen: number;
  lastChecked: number;
  missingSince?: number;
}

/** EN: Human-readable state copy (EN/ES) for the UI. / ES: Textos legibles del estado (EN/ES) para la UI. */
export const TX_STATE_COPY: Record<TxState, { en: string; es: string }> = {
  submitted: { en: 'Sent to your wallet provider', es: 'Enviada a tu proveedor de wallet' },
  pending: { en: 'Waiting to be included in a block', es: 'Esperando ser incluida en un bloque' },
  confirming: { en: 'Included, waiting for confirmations', es: 'Incluida, esperando confirmaciones' },
  confirmed: { en: 'Confirmed', es: 'Confirmada' },
  failed: { en: 'Failed (reverted). No changes were made, but the network fee was spent.', es: 'Falló (revertida). No hubo cambios, pero se gastó la comisión de red.' },
  dropped: { en: 'Dropped by the network. You may retry.', es: 'Descartada por la red. Podés reintentar.' },
};

export class TxMonitor {
  private readonly txs = new Map<string, TrackedTx>();
  constructor(private readonly chain: ChainReader, private readonly required = 3, private readonly dropAfterMs = 10 * 60_000) {}

  track(hash: string, now = Date.now()): TrackedTx {
    const t: TrackedTx = { hash, state: 'submitted', confirmations: 0, required: this.required, firstSeen: now, lastChecked: now };
    this.txs.set(hash, t);
    return t;
  }

  get(hash: string): TrackedTx | undefined {
    return this.txs.get(hash);
  }

  /** EN: Poll all non-final txs once; returns those that changed. / ES: Consulta una vez las no finales; devuelve las que cambiaron. */
  async poll(now = Date.now()): Promise<TrackedTx[]> {
    const changed: TrackedTx[] = [];
    const head = await this.chain.blockNumber();
    for (const t of this.txs.values()) {
      if (t.state === 'failed' || t.state === 'dropped') continue;
      const before = `${t.state}:${t.confirmations}`;
      const r = await this.chain.receipt(t.hash);
      if (r) {
        t.missingSince = undefined;
        if (r.status === 'reverted') t.state = 'failed';
        else {
          t.confirmations = Number(head - r.blockNumber + 1n);
          t.state = t.confirmations >= t.required ? 'confirmed' : 'confirming';
        }
      } else if (await this.chain.known(t.hash)) {
        // EN: Covers reorgs: a previously mined tx back in mempool. / ES: Cubre reorgs: una tx minada vuelve al mempool.
        t.state = 'pending';
        t.confirmations = 0;
        t.missingSince = undefined;
      } else {
        t.missingSince ??= now;
        t.confirmations = 0;
        t.state = now - t.missingSince >= this.dropAfterMs ? 'dropped' : t.state === 'submitted' ? 'submitted' : 'pending';
      }
      t.lastChecked = now;
      if (`${t.state}:${t.confirmations}` !== before) changed.push({ ...t });
    }
    return changed;
  }
}
