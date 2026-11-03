/**
 * EN: In-memory store for the reference build (users, sessions revocation, analytics). The
 *     interfaces are small on purpose so a Postgres implementation can replace it (see
 *     01-discovery data model). Restarting the API clears data — documented limitation.
 * ES: Almacén en memoria para la versión de referencia (usuarios, revocación de sesiones, analítica).
 *     Las interfaces son chicas a propósito para reemplazarlas por Postgres (ver modelo de datos en
 *     01-discovery). Reiniciar la API borra los datos — limitación documentada.
 */
import type { Role, UserRecord } from '@palooza/identity';
import type { AnalyticsEvent } from '@palooza/analytics';

export interface User extends UserRecord {
  role: Role;
  passwordHash: string;
  frozen: boolean;
  wallet: string | null;
}

export class MemoryStore {
  readonly users = new Map<string, User>();
  readonly byEmail = new Map<string, string>();
  readonly revokedSessions = new Set<string>();
  readonly events: AnalyticsEvent[] = [];
  private seq = 0;

  nextId(prefix: string): string {
    return `${prefix}_${(++this.seq).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  addUser(u: User): void {
    this.users.set(u.id, u);
    this.byEmail.set(u.email.toLowerCase(), u.id);
  }

  findByEmail(email: string): User | undefined {
    const id = this.byEmail.get(email.toLowerCase());
    return id ? this.users.get(id) : undefined;
  }

  walletOwner(addr: string): User | undefined {
    return [...this.users.values()].find((u) => u.wallet?.toLowerCase() === addr.toLowerCase());
  }
}
