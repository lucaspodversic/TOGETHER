/**
 * EN: EN/ES dictionary and helpers; missing keys fall back to English.
 * ES: Diccionario EN/ES y utilidades; las claves faltantes vuelven al inglés.
 * EN: errorText maps API error codes to friendly, non-leaky messages.
 * ES: errorText traduce códigos de error de la API a mensajes amables y sin filtrar datos.
 */
/**
 * EN: Tiny i18n layer (en/es). Pure dictionary + lookup so it is testable without React.
 *     Missing keys fall back to English, then to the key itself (never crash the UI).
 * ES: Capa i18n mínima (en/es). Diccionario puro + búsqueda, testeable sin React.
 *     Las claves faltantes caen a inglés y luego a la clave misma (nunca rompe la UI).
 */
export type Locale = 'en' | 'es';
export const LOCALES: Locale[] = ['en', 'es'];

export const DICT = {
  en: {
    'nav.games': 'Games', 'nav.leaderboards': 'Leaderboards', 'nav.achievements': 'Achievements', 'nav.profile': 'Profile',
    'nav.wallet': 'Wallet', 'nav.admin': 'Admin', 'nav.login': 'Log in', 'nav.logout': 'Log out', 'nav.signup': 'Sign up',
    'banner.points': 'Play points have no cash value', 'home.title': 'Play quick games, climb the boards, earn badges.',
    'home.cta': 'Create your account', 'home.play': 'Browse games',
    'auth.email': 'Email', 'auth.password': 'Password', 'auth.displayName': 'Display name', 'auth.birthDate': 'Date of birth',
    'auth.region': 'Country code (2 letters)', 'auth.submit': 'Continue', 'auth.forgot': 'Forgot password?', 'auth.reset': 'Send reset link',
    'auth.ageNote': 'We use your birth date only to check eligibility.',
    'games.play': 'Play', 'games.max': 'Max score', 'game.start': 'Start', 'game.submit': 'Submit', 'game.result': 'Result',
    'game.status.accepted': 'Score accepted!', 'game.status.rejected': 'Score rejected', 'game.status.held': 'Held for review',
    'game.loginNeeded': 'Log in to record your score.', 'reaction.wait': 'Wait for green…', 'reaction.now': 'TAP NOW!', 'reaction.early': 'Too early — try again',
    'g2048.keys': 'Use arrow keys or the buttons.', 'memory.attempts': 'Attempts',
    'lb.rank': 'Rank', 'lb.player': 'Player', 'lb.score': 'Score', 'lb.empty': 'No scores yet.', 'lb.live': 'Live',
    'profile.level': 'Level', 'profile.xp': 'XP', 'profile.points': 'Play points', 'profile.export': 'Download my data', 'profile.delete': 'Delete my account',
    'profile.deleteConfirm': 'This permanently deletes your account. Continue?',
    'wallet.title': 'Wallet (optional)', 'wallet.connect': 'Connect wallet', 'wallet.sign': 'Sign in with Ethereum', 'wallet.linked': 'Linked wallet',
    'wallet.none': 'No browser wallet detected. Everything else works without one.', 'wallet.testnet': 'Local Anvil or Sepolia testnet only.',
    'admin.users': 'Users', 'admin.freeze': 'Freeze', 'admin.unfreeze': 'Unfreeze', 'admin.held': 'Held sessions', 'admin.approve': 'Approve', 'admin.void': 'Void',
    'admin.flags': 'Feature flags (gated pending legal review)', 'admin.audit': 'Audit log', 'admin.reconcile': 'Reconcile ledger',
    'common.loading': 'Loading…', 'common.error': 'Something went wrong', 'common.lang': 'Español',
  },
  es: {
    'nav.games': 'Juegos', 'nav.leaderboards': 'Rankings', 'nav.achievements': 'Logros', 'nav.profile': 'Perfil',
    'nav.wallet': 'Wallet', 'nav.admin': 'Admin', 'nav.login': 'Ingresar', 'nav.logout': 'Salir', 'nav.signup': 'Registrarse',
    'banner.points': 'Los puntos de juego no tienen valor monetario', 'home.title': 'Jugá partidas rápidas, subí en los rankings y ganá insignias.',
    'home.cta': 'Crear tu cuenta', 'home.play': 'Ver juegos',
    'auth.email': 'Email', 'auth.password': 'Contraseña', 'auth.displayName': 'Nombre visible', 'auth.birthDate': 'Fecha de nacimiento',
    'auth.region': 'Código de país (2 letras)', 'auth.submit': 'Continuar', 'auth.forgot': '¿Olvidaste la contraseña?', 'auth.reset': 'Enviar enlace',
    'auth.ageNote': 'Usamos tu fecha de nacimiento solo para verificar elegibilidad.',
    'games.play': 'Jugar', 'games.max': 'Puntaje máximo', 'game.start': 'Empezar', 'game.submit': 'Enviar', 'game.result': 'Resultado',
    'game.status.accepted': '¡Puntaje aceptado!', 'game.status.rejected': 'Puntaje rechazado', 'game.status.held': 'Retenido para revisión',
    'game.loginNeeded': 'Ingresá para registrar tu puntaje.', 'reaction.wait': 'Esperá el verde…', 'reaction.now': '¡AHORA!', 'reaction.early': 'Muy pronto — probá de nuevo',
    'g2048.keys': 'Usá las flechas o los botones.', 'memory.attempts': 'Intentos',
    'lb.rank': 'Puesto', 'lb.player': 'Jugador', 'lb.score': 'Puntaje', 'lb.empty': 'Todavía no hay puntajes.', 'lb.live': 'En vivo',
    'profile.level': 'Nivel', 'profile.xp': 'XP', 'profile.points': 'Puntos de juego', 'profile.export': 'Descargar mis datos', 'profile.delete': 'Borrar mi cuenta',
    'profile.deleteConfirm': 'Esto borra tu cuenta para siempre. ¿Continuar?',
    'wallet.title': 'Wallet (opcional)', 'wallet.connect': 'Conectar wallet', 'wallet.sign': 'Firmar con Ethereum', 'wallet.linked': 'Wallet vinculada',
    'wallet.none': 'No se detectó una wallet en el navegador. Todo lo demás funciona sin ella.', 'wallet.testnet': 'Solo Anvil local o testnet Sepolia.',
    'admin.users': 'Usuarios', 'admin.freeze': 'Congelar', 'admin.unfreeze': 'Descongelar', 'admin.held': 'Sesiones retenidas', 'admin.approve': 'Aprobar', 'admin.void': 'Anular',
    'admin.flags': 'Feature flags (bloqueadas hasta revisión legal)', 'admin.audit': 'Log de auditoría', 'admin.reconcile': 'Conciliar ledger',
    'common.loading': 'Cargando…', 'common.error': 'Algo salió mal', 'common.lang': 'English',
  },
} as const;

export type MsgKey = keyof (typeof DICT)['en'];

/** EN: Translate a key. / ES: Traduce una clave. */
export function translate(locale: Locale, key: MsgKey | string): string {
  const d = DICT[locale] as Record<string, string>;
  return d[key] ?? (DICT.en as Record<string, string>)[key] ?? key;
}

/** EN: Pick initial locale from a navigator language. / ES: Elige el idioma inicial según el navegador. */
export const detectLocale = (lang: string | undefined): Locale => (lang?.toLowerCase().startsWith('es') ? 'es' : 'en');

// EN: API error codes → friendly bilingual copy. / ES: Códigos de error de la API → textos amigables bilingües.
const ERRORS: Record<string, { en: string; es: string }> = {
  invalid_credentials: { en: 'Email or password is incorrect.', es: 'Email o contraseña incorrectos.' },
  not_eligible: { en: "Sorry, you're not eligible to create an account.", es: 'Lo sentimos, no cumplís los requisitos para crear una cuenta.' },
  email_unavailable: { en: 'That email cannot be used.', es: 'Ese email no se puede usar.' },
  password_too_short: { en: 'Password must have at least 10 characters.', es: 'La contraseña debe tener al menos 10 caracteres.' },
  rate_limited: { en: 'Too many attempts, wait a minute.', es: 'Demasiados intentos, esperá un minuto.' },
  account_frozen: { en: 'Your account is frozen. Contact support.', es: 'Tu cuenta está congelada. Contactá a soporte.' },
  feature_gated: { en: 'This feature is not available.', es: 'Esta función no está disponible.' },
  session_expired: { en: 'The game session expired.', es: 'La sesión de juego expiró.' },
};
export const errorText = (locale: Locale, code: string) => ERRORS[code]?.[locale] ?? translate(locale, 'common.error');
