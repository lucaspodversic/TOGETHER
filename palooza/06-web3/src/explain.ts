/**
 * EN: Plain-language explanations shown before any wallet prompt.
 * ES: Explicaciones en lenguaje simple mostradas antes de cualquier aviso de wallet.
 * EN: Copy must never promise value, yield or tradability.
 * ES: El texto nunca debe prometer valor, rendimiento ni negociabilidad.
 */
/**
 * EN: Plain-language explanations of every wallet request, shown BEFORE the wallet pops up.
 *     The brief requires clear explanations of signing requests, fees, permissions and failures.
 * ES: Explicaciones en lenguaje simple de cada pedido de la wallet, mostradas ANTES de que se abra.
 *     El brief exige explicar claramente pedidos de firma, comisiones, permisos y fallas.
 */
export type WalletAction = 'connect' | 'siwe' | 'mint_badge';

export interface Explanation { title: string; whatHappens: string; cost: string; permissions: string; risks: string }

export const EXPLANATIONS: Record<WalletAction, { en: Explanation; es: Explanation }> = {
  connect: {
    en: { title: 'Connect wallet', whatHappens: 'Palooza reads your public address. Nothing is signed or sent.', cost: 'Free.', permissions: 'Read-only: address and current network.', risks: 'None. You can disconnect any time.' },
    es: { title: 'Conectar wallet', whatHappens: 'Palooza lee tu dirección pública. No se firma ni envía nada.', cost: 'Gratis.', permissions: 'Solo lectura: dirección y red actual.', risks: 'Ninguno. Podés desconectarte cuando quieras.' },
  },
  siwe: {
    en: { title: 'Link wallet (sign message)', whatHappens: 'You sign a text message proving you own this address. It is NOT a transaction.', cost: 'Free — no gas.', permissions: 'No token approvals, no spending rights.', risks: 'Only sign if the message shows this site’s domain and a Palooza nonce.' },
    es: { title: 'Vincular wallet (firmar mensaje)', whatHappens: 'Firmás un mensaje de texto que prueba que esta dirección es tuya. NO es una transacción.', cost: 'Gratis — sin gas.', permissions: 'Sin aprobaciones de tokens ni permisos de gasto.', risks: 'Firmá solo si el mensaje muestra el dominio de este sitio y un nonce de Palooza.' },
  },
  mint_badge: {
    en: { title: 'Mint achievement badge (testnet)', whatHappens: 'A non-transferable badge is minted to your address on a TEST network.', cost: 'Testnet gas only (no real money). Disabled unless FEATURE_NFT_MINT is on.', permissions: 'None granted to Palooza.', risks: 'Badges are public on-chain and permanent unless you burn them.' },
    es: { title: 'Mintear insignia de logro (testnet)', whatHappens: 'Se mintea una insignia intransferible a tu dirección en una red de PRUEBA.', cost: 'Solo gas de testnet (sin dinero real). Deshabilitado salvo que FEATURE_NFT_MINT esté encendido.', permissions: 'No se otorga ningún permiso a Palooza.', risks: 'Las insignias son públicas on-chain y permanentes salvo que las quemes.' },
  },
};

/** EN: Map raw wallet/RPC errors to friendly, actionable messages. / ES: Traduce errores crudos a mensajes claros. */
export function explainError(err: unknown, lang: 'en' | 'es' = 'en'): string {
  const m = String((err as { message?: string })?.message ?? err).toLowerCase();
  const t = (en: string, es: string) => (lang === 'es' ? es : en);
  if (m.includes('user rejected') || m.includes('4001')) return t('You cancelled the request in your wallet.', 'Cancelaste el pedido en tu wallet.');
  if (m.includes('unsupported_chain') || m.includes('chain mismatch')) return t('Switch your wallet to Anvil (local) or Sepolia.', 'Cambiá tu wallet a Anvil (local) o Sepolia.');
  if (m.includes('insufficient funds')) return t('Not enough test ETH for gas. Use a Sepolia faucet.', 'No alcanza el ETH de prueba para el gas. Usá un faucet de Sepolia.');
  if (m.includes('siwe_nonce') || m.includes('siwe_expired')) return t('The sign-in request expired. Please try again.', 'El pedido de firma venció. Probá de nuevo.');
  if (m.includes('feature_gated')) return t('This feature is not available yet.', 'Esta función todavía no está disponible.');
  return t('Something went wrong. Nothing was charged; please retry.', 'Algo salió mal. No se cobró nada; probá de nuevo.');
}
