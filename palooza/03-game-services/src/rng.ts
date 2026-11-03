/**
 * EN: Deterministic seeded PRNG (mulberry32) + string→seed hash (FNV-1a). Pure and browser-safe,
 *     so the browser and the server replay the exact same game from the same seed.
 *     NOT cryptographic — it is only for gameplay layout, never for anything of value.
 * ES: PRNG determinista con semilla (mulberry32) + hash string→semilla (FNV-1a). Puro y apto para
 *     navegador, así navegador y servidor reproducen exactamente la misma partida con la misma semilla.
 *     NO es criptográfico — solo sirve para el layout del juego, nunca para algo con valor.
 */
export function seedFrom(s: string): number {
  // EN: FNV-1a 32-bit. / ES: FNV-1a de 32 bits.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** EN: Returns a function producing floats in [0,1). / ES: Devuelve una función que produce floats en [0,1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** EN: Fisher–Yates shuffle with a given RNG (copy). / ES: Mezcla Fisher–Yates con un RNG dado (copia). */
export function shuffle<T>(arr: readonly T[], rnd: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
