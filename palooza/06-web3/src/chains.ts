/**
 * EN: Allow-listed chains: anvil (31337) and Sepolia (11155111) only.
 * ES: Cadenas permitidas: solo anvil (31337) y Sepolia (11155111).
 * EN: Mainnet ids are rejected by design until legal review.
 * ES: Los ids de mainnet se rechazan por diseño hasta la revisión legal.
 */
/**
 * EN: Chain allow-list. This reference build only talks to a local anvil node or Sepolia testnet.
 *     Mainnet is deliberately absent: it requires the Milestone-4 review gates first.
 * ES: Lista permitida de cadenas. Esta versión de referencia solo habla con un nodo anvil local o la
 *     testnet Sepolia. Mainnet falta a propósito: requiere primero las compuertas de revisión del Hito 4.
 */
export interface ChainInfo { id: number; name: string; confirmations: number; explorer?: string; testnet: true }

export const SUPPORTED_CHAINS: Record<number, ChainInfo> = {
  31337: { id: 31337, name: 'Anvil (local)', confirmations: 1, testnet: true },
  11155111: { id: 11155111, name: 'Sepolia', confirmations: 3, explorer: 'https://sepolia.etherscan.io', testnet: true },
};

/** EN: Throws for unsupported chains. / ES: Lanza para cadenas no soportadas. */
export function assertSupportedChain(id: number): ChainInfo {
  const c = SUPPORTED_CHAINS[id];
  if (!c) throw new Error(`unsupported_chain:${id}`);
  return c;
}
