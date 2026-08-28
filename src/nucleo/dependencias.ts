import type { Reloj } from './reloj'

/** El `fetch` del entorno en producción; uno grabado en los tests. */
export type Fetch = typeof globalThis.fetch

/**
 * Todo lo que la aplicación no puede fabricar por sí misma. Son dos, y la
 * lista es corta a propósito: cada costura nueva es una forma más de que un
 * test se parezca poco a producción.
 */
export interface Dependencias {
  fetch: Fetch
  reloj: Reloj
}
