import type { Reloj } from '@/nucleo/reloj'

/**
 * Lo que hay entre la aplicación y el SEPE: nadie llama sin fichar antes.
 *
 * Es una interfaz y no una función suelta porque este freno vive hoy en la
 * memoria del proceso, y en serverless esa memoria no existe entre
 * invocaciones: dos visitantes simultáneos serían dos peticiones en el mismo
 * instante. El sustituto —un cubo de fichas en un almacén compartido— entra
 * por aquí sin tocar nada por encima.
 */
export interface Freno {
  /** Se resuelve cuando toca lanzar la siguiente petición al SEPE. */
  fichar(): Promise<void>
}

/**
 * Por debajo de esto el SEPE deja de contestar. Está medido, no es prudencia
 * excesiva, y no es un parámetro que un test pueda bajar: un test que necesite
 * tiempo mueve el reloj.
 */
export const PAUSA_MINIMA_MS = 2500

/**
 * Hasta tanto más, al azar. Una petición cada 2,5 segundos clavados no la hace
 * ningún humano y es justo el patrón que se detecta.
 */
export const JITTER_MAXIMO_MS = 1500

/**
 * El freno mientras dure la memoria del proceso.
 *
 * Las fichas se reparten **en serie** —cada llamada espera a la anterior— para
 * que dos búsquedas a la vez no se cuelen las dos por el mismo hueco: sin la
 * cadena, ambas leerían el mismo "última llamada" y saldrían juntas.
 */
export function crearFrenoEnMemoria(reloj: Reloj): Freno {
  let ultimaLlamada = Number.NEGATIVE_INFINITY
  let cola: Promise<void> = Promise.resolve()

  return {
    fichar() {
      cola = cola.then(async () => {
        const pausa = PAUSA_MINIMA_MS + Math.random() * JITTER_MAXIMO_MS
        const espera = ultimaLlamada + pausa - reloj.ahora()
        if (espera > 0) await reloj.esperar(espera)
        ultimaLlamada = reloj.ahora()
      })
      return cola
    },
  }
}
