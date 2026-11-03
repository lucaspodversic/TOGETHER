/**
 * EN: Role-based access control for admin tooling. Permissions are explicit strings;
 *     roles map to permission sets. Deny by default.
 * ES: Control de acceso por roles para herramientas de admin. Los permisos son strings explícitos;
 *     los roles mapean a conjuntos de permisos. Denegado por defecto.
 */
export type Role = 'player' | 'support' | 'moderator' | 'admin';

export type Permission =
  | 'profile:read_own'
  | 'profile:update_own'
  | 'users:read'
  | 'users:freeze'
  | 'scores:void'
  | 'rewards:adjust'
  | 'flags:read'
  | 'flags:write'
  | 'audit:read';

// EN: Least privilege: each role gets only what its job needs.
// ES: Mínimo privilegio: cada rol recibe solo lo que su trabajo necesita.
const MATRIX: Record<Role, readonly Permission[]> = {
  player: ['profile:read_own', 'profile:update_own'],
  support: ['profile:read_own', 'users:read', 'audit:read'],
  moderator: ['profile:read_own', 'users:read', 'users:freeze', 'scores:void', 'audit:read'],
  admin: ['profile:read_own', 'profile:update_own', 'users:read', 'users:freeze', 'scores:void', 'rewards:adjust', 'flags:read', 'flags:write', 'audit:read'],
};

/** EN: True if the role holds the permission. / ES: True si el rol tiene el permiso. */
export function can(role: Role | undefined, perm: Permission): boolean {
  // EN: Unknown roles get nothing. / ES: Roles desconocidos no reciben nada.
  return !!role && (MATRIX[role] ?? []).includes(perm);
}

/** EN: List permissions of a role (for UI). / ES: Lista permisos de un rol (para la UI). */
export const permissionsOf = (role: Role): readonly Permission[] => MATRIX[role] ?? [];

/** EN: Type guard for role strings. / ES: Guarda de tipo para strings de rol. */
export const isRole = (r: unknown): r is Role => typeof r === 'string' && r in MATRIX;
