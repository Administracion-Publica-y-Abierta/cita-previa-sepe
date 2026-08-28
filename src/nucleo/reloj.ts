/**
 * El reloj es una dependencia, no una llamada a `Date.now()` perdida por ahí.
 *
 * Motivo: las dos cosas que más falta hace probar de este proyecto son de
 * tiempo —el freno de 2,5 s entre peticiones al SEPE y la caducidad de la
 * caché— y con el reloj del sistema solo hay dos salidas, esperar de verdad o
 * no probarlas. Las dos son inaceptables, así que el reloj se inyecta.
 */
export interface Reloj {
  /** Milisegundos desde época, como `Date.now()`. */
  ahora(): number
  /** Se resuelve cuando han pasado `milisegundos` de este reloj. */
  esperar(milisegundos: number): Promise<void>
}

export const relojDelSistema: Reloj = {
  ahora: () => Date.now(),
  esperar: (milisegundos) => new Promise((seguir) => setTimeout(seguir, milisegundos)),
}
