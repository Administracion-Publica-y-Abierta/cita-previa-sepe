import { crearApp, type App } from '@/nucleo/app'
import { instalarApp } from '@/nucleo/app-de-produccion'
import { crearFetchFalso, type FetchFalso, type RespuestaAMano } from './fetch-falso'
import { crearRelojFalso, type RelojFalso } from './reloj-falso'

/**
 * El instante en que se tomó la segunda captura.
 *
 * Los tests arrancan aquí para que el "hoy" del reloj falso encaje con las
 * fechas de los fixtures: el primer hueco grabado es del 17 de agosto de 2026,
 * y con el reloj del sistema sería pasado y los filtros de fecha lo taparían.
 */
export const INSTANTE_DE_LAS_CAPTURAS = Date.parse('2026-08-14T13:37:10+02:00')

export interface OpcionesDeMontaje {
  /** Respuestas puestas a mano, para los caminos que no hay grabados (errores, vacíos). */
  respuestas?: RespuestaAMano[]
  /** Otro punto de partida del reloj, para probar qué pasa en otra fecha. */
  instanteInicial?: number
}

export interface AppDePrueba {
  app: App
  /** El `fetch` grabado. `fetch.llamadas` cuenta lo que se le pidió al SEPE. */
  fetch: FetchFalso
  /** El reloj: `reloj.avanzar(ms)` mueve el tiempo sin gastarlo. */
  reloj: RelojFalso
}

/**
 * Monta la aplicación con un `fetch` y un reloj falsos. **Este es el patrón:**
 * cualquier test nuevo empieza por aquí y entra por la ruta o la función que
 * quiera probar, sin tocar nada por dentro.
 *
 *     const { app, fetch, reloj } = montarApp()
 */
export function montarApp(opciones: OpcionesDeMontaje = {}): AppDePrueba {
  const reloj = crearRelojFalso(opciones.instanteInicial ?? INSTANTE_DE_LAS_CAPTURAS)
  const fetch = crearFetchFalso({ reloj, respuestas: opciones.respuestas })
  const app = crearApp({ fetch, reloj })

  // Los Route Handlers no reciben la aplicación por parámetro —la firma la pone
  // Next—, así que se les deja puesta esta. Es lo que permite que un test entre
  // por la ruta de verdad sin salir a la red de verdad.
  instalarApp(app)

  return { app, fetch, reloj }
}
