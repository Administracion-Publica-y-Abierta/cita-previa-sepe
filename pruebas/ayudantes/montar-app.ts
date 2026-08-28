import type { Almacen } from '@/almacen/almacen'
import { crearAlmacenEnMemoria } from '@/almacen/en-memoria'
import { crearApp, type App } from '@/nucleo/app'
import { instalarApp } from '@/nucleo/app-de-produccion'
import type { Configuracion } from '@/nucleo/configuracion'
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
  /**
   * Lo que se ajusta sin tocar código: TTL de la caché y ancho de su clave.
   * Existe para que los tests de la caché se escriban sobre el parámetro y no
   * sobre el valor que tenga hoy.
   */
  configuracion?: Partial<Configuracion>
  /**
   * Otro almacén. Por defecto, el de memoria, que es el que corre en local.
   * Se pasa para lo único que no se puede montar de otra forma: probar qué
   * hace la aplicación cuando el almacén compartido no contesta.
   */
  almacen?: Almacen
}

export interface AppDePrueba {
  app: App
  /** El `fetch` grabado. `fetch.llamadas` cuenta lo que se le pidió al SEPE. */
  fetch: FetchFalso
  /** El reloj: `reloj.avanzar(ms)` mueve el tiempo sin gastarlo. */
  reloj: RelojFalso
  /** El estado compartido: el freno y la caché viven aquí. */
  almacen: Almacen
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
  const almacen = opciones.almacen ?? crearAlmacenEnMemoria(reloj)
  const app = crearApp({ fetch, reloj }, { almacen, configuracion: opciones.configuracion })

  // Los Route Handlers no reciben la aplicación por parámetro —la firma la pone
  // Next—, así que se les deja puesta esta. Es lo que permite que un test entre
  // por la ruta de verdad sin salir a la red de verdad.
  instalarApp(app)

  return { app, fetch, reloj, almacen }
}

/**
 * Otra invocación del mismo despliegue.
 *
 * Aplicación nueva, con su memoria nueva y su `fetch` propio, compartiendo el
 * reloj y **el almacén**. Es lo más parecido a dos funciones serverless
 * atendiendo a la vez que se puede montar en un test, y es la única forma de
 * comprobar lo que de verdad se pide del freno y de la caché: que valgan entre
 * invocaciones y no solo dentro de una.
 *
 * No se instala en los Route Handlers: la aplicación que ven las rutas sigue
 * siendo la primera, que es la que el test montó.
 */
export function otraInvocacion(previa: AppDePrueba, opciones: OpcionesDeMontaje = {}): AppDePrueba {
  const fetch = crearFetchFalso({ reloj: previa.reloj, respuestas: opciones.respuestas })
  const app = crearApp(
    { fetch, reloj: previa.reloj },
    { almacen: previa.almacen, configuracion: opciones.configuracion },
  )

  return { app, fetch, reloj: previa.reloj, almacen: previa.almacen }
}
