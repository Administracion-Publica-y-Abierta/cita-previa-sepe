import type { Fetch } from '@/nucleo/dependencias'
import { registro } from '@/nucleo/registro'
import type { Almacen } from './almacen'

/**
 * El almacén compartido de verdad, hablando con Redis por su API REST.
 *
 * Por REST y no por el protocolo de siempre porque el destino es serverless:
 * una conexión que hay que abrir, mantener y cerrar no encaja con un proceso
 * que vive lo que dura una petición. Y por `fetch` en vez de por una
 * biblioteca cliente porque `fetch` ya es la costura de este proyecto: así
 * esto se prueba con el mismo doble que todo lo demás, en vez de quedarse
 * como la única pieza sin probar y encima la que sostiene el freno.
 *
 * Cada operación es **un comando de Redis**, no una secuencia nuestra de leer
 * y escribir: la atomicidad la decide el servidor. Es lo que hace que dos
 * invocaciones distintas no puedan llevarse la misma ficha.
 */
export interface AjustesDeRedis {
  fetch: Fetch
  url: string
  ficha: string
}

/**
 * Cuando el almacén no contesta.
 *
 * Se distingue de cualquier otro fallo porque tiene una respuesta propia y no
 * negociable: sin almacén no hay freno, y sin freno no se llama al SEPE. Ver
 * `reservar`.
 */
export class AlmacenNoResponde extends Error {
  constructor() {
    // Sin detalle del error original: su mensaje arrastra la URL del almacén.
    super('El almacén compartido no ha contestado.')
    this.name = 'AlmacenNoResponde'
  }
}

export function crearAlmacenRedis({ fetch, url, ficha }: AjustesDeRedis): Almacen {
  async function ordenar(orden: (string | number)[]): Promise<unknown> {
    let respuesta: Response
    try {
      respuesta = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${ficha}`, 'content-type': 'application/json' },
        body: JSON.stringify(orden.map(String)),
      })
    } catch {
      throw new AlmacenNoResponde()
    }
    if (!respuesta.ok) throw new AlmacenNoResponde()
    return ((await respuesta.json()) as { result?: unknown }).result ?? null
  }

  return {
    /**
     * Si el almacén falla en una lectura, la aplicación sigue: es un fallo de
     * caché, y no le hace daño al SEPE. Lo único que aquí no se traga es el
     * reparto de fichas, que es de lo que depende el freno.
     */
    async leer<T>(clave: string): Promise<T | null> {
      let crudo: unknown
      try {
        crudo = await ordenar(['GET', clave])
      } catch {
        registro.aviso('el almacén compartido no contesta a una lectura: se sigue como si no hubiera nada guardado')
        return null
      }
      if (typeof crudo !== 'string') return null
      try {
        return JSON.parse(crudo) as T
      } catch {
        return null
      }
    },

    async guardar(clave, valor, vidaMs) {
      try {
        await ordenar(['SET', clave, JSON.stringify(valor), 'PX', Math.ceil(vidaMs)])
      } catch {
        registro.aviso('el almacén compartido no contesta a una escritura: esta vez no se guarda nada')
      }
    },

    /**
     * `SET NX PX`: el servidor decide quién se lleva la clave. Si no la
     * consigue, `PTTL` dice cuánto falta.
     *
     * Aquí el error **no** se traga. Sin almacén no hay ritmo compartido, y
     * seguir sin él sería exactamente lo que este módulo existe para impedir:
     * cada invocación llamando al SEPE cuando le apeteciera. Se prefiere no
     * contestar a atropellar un servicio público.
     */
    async reservar(clave, vidaMs) {
      const puesta = await ordenar(['SET', clave, '1', 'NX', 'PX', Math.ceil(vidaMs)])
      if (puesta === 'OK') return 0

      const restante = Number(await ordenar(['PTTL', clave]))
      // Si entre las dos órdenes la clave ha caducado, Redis contesta que no
      // existe. Un milisegundo, y quien pregunta lo vuelve a intentar: la
      // ficha no se da por buena solo porque el reloj haya ido justo.
      return restante > 0 ? restante : 1
    },

    async sumarUno(clave, vidaMs) {
      try {
        const sumado = Number(await ordenar(['INCR', clave]))
        // La caducidad va aparte porque `INCRBY` no la pone. Se renueva en
        // cada suma a propósito: lo que interesa es si el SEPE está dando
        // vacíos *ahora*, no cuántos dio hace media hora.
        await ordenar(['PEXPIRE', clave, Math.ceil(vidaMs)])
        return sumado
      } catch {
        registro.aviso('el almacén compartido no contesta a una cuenta: este vacío no llega a endurecer el freno')
        return 0
      }
    },

    async olvidar(clave) {
      try {
        await ordenar(['DEL', clave])
      } catch {
        registro.aviso('el almacén compartido no contesta a un borrado: la clave se soltará sola al caducar')
      }
    },
  }
}
