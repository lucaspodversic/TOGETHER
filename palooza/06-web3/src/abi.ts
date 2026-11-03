/**
 * EN: Minimal ABI of PaloozaBadges used by the backend/frontend (kept in sync with contracts/src).
 * ES: ABI mínima de PaloozaBadges usada por backend/frontend (sincronizada con contracts/src).
 */
export const paloozaBadgesAbi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }, { name: 'id', type: 'uint256' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'id', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'registerBadge', stateMutability: 'nonpayable', inputs: [{ name: 'id', type: 'uint256' }, { name: 'uri_', type: 'string' }], outputs: [] },
  { type: 'function', name: 'setMinter', stateMutability: 'nonpayable', inputs: [{ name: 'minter', type: 'address' }, { name: 'allowed', type: 'bool' }], outputs: [] },
  { type: 'function', name: 'locked', stateMutability: 'view', inputs: [{ name: 'id', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

// EN: Achievement id → badge token id (same order as DeployLocal.s.sol). / ES: Logro → id de insignia.
export const BADGE_IDS: Record<string, number> = { first_game: 1, explorer: 2, memory_master: 3, lightning: 4, tile_1000: 5, dedicated: 6 };
