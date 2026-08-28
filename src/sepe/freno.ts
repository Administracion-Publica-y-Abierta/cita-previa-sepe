import type { Almacen } from '@/almacen/almacen'
import { registro } from '@/nucleo/registro'
import type { Reloj } from '@/nucleo/reloj'

/**
 * Lo que hay entre la aplicación y el SEPE: nadie llama sin fichar antes.
 *
 * El ritmo se sostiene en el almacén compartido y no en variables de este
 * proceso, porque en serverless esa memoria no existe entre invocaciones: dos
 * visitantes simultáneos serían dos peticiones en el mismo instante.
 */
export interface Freno {
  /**
   * Se resuelve cuando toca lanzar la siguiente petición al SEPE.
   *
   * Si no hay ficha en un plazo razonable, revienta con `SinFicha`. Lo que no
   * hace nunca —ni con el almacén caído, ni con la cola llena— es dejar pasar.
   */
  fichar(): Promise<void>
  /**
   * Cómo ha ido la última respuesta del SEPE. Los vacíos seguidos endurecen el
   * ritmo; una respuesta buena lo devuelve a la normalidad.
   */
  anotar(respuesta: 'vacia' | 'buena'): Promise<void>
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

/** Tres vacíos seguidos son el SEPE diciendo que se le está molestando. */
export const VACIOS_PARA_ENDURECER = 3

/** Por mucho que se endurezca, dos minutos entre peticiones es el techo. */
export const TECHO_MS = 120_000

/**
 * Lo que se espera por una ficha antes de rendirse.
 *
 * Quince segundos porque quien pregunta ya se ha ido, y porque una función
 * serverless tiene su propio límite de duración: pasarse de aquí es pagar
 * tiempo de ejecución para contestar a nadie. Rendirse es servir lo que haya
 * en la caché aunque esté caducado, o pedir que vuelva en un momento.
 */
export const PLAZO_RAZONABLE_MS = 15_000

/**
 * Cuánto se recuerda una racha de vacíos.
 *
 * Diez minutos: lo justo para que el endurecimiento sobreviva a una racha,
 * y lo bastante poco para que una tarde sin visitas no arranque frenada por
 * lo que pasó ayer.
 */
export const MEMORIA_DE_LOS_VACIOS_MS = 600_000

/** La ficha del ritmo global. Su caducidad **es** la pausa hasta la siguiente. */
const FICHA = 'freno:ficha'

/** Vacíos seguidos. Lo que endurece el ritmo. */
const VACIOS = 'freno:vacios'

/** No ha habido ficha en un plazo razonable. Nunca significa "pasa igualmente". */
export class SinFicha extends Error {
  constructor() {
    super('No ha habido ficha del freno en un plazo razonable.')
    this.name = 'SinFicha'
  }
}

export function crearFrenoCompartido(piezas: { almacen: Almacen; reloj: Reloj }): Freno {
  const { almacen, reloj } = piezas

  /**
   * La pausa que le toca a la siguiente petición.
   *
   * Se consulta en cada intento y no una sola vez porque la racha de vacíos
   * puede empezar mientras alguien está esperando: el freno tiene que
   * endurecerse para quien ya está en la cola, no solo para el siguiente.
   */
  async function pausa(): Promise<number> {
    const vacios = (await almacen.leer<number>(VACIOS)) ?? 0
    const minima = PAUSA_MINIMA_MS + Math.random() * JITTER_MAXIMO_MS
    if (vacios < VACIOS_PARA_ENDURECER) return minima
    // Se dobla por cada vacío de más, igual que en el prototipo: insistir al
    // mismo ritmo cuando el SEPE ya está devolviendo vacíos solo alarga el
    // frenazo. El exponente se topa por si la racha se hace larga; el techo de
    // dos minutos manda de todas formas.
    return Math.min(TECHO_MS, minima * 2 ** Math.min(vacios - VACIOS_PARA_ENDURECER + 1, 6))
  }

  return {
    async fichar() {
      const limite = reloj.ahora() + PLAZO_RAZONABLE_MS

      for (;;) {
        let restante: number
        try {
          restante = await almacen.reservar(FICHA, await pausa())
        } catch {
          // Sin almacén no hay ritmo compartido, y sin ritmo compartido cada
          // invocación llamaría al SEPE cuando le apeteciera. Se prefiere no
          // contestar.
          registro.aviso('el almacén compartido no reparte fichas: sin freno no se llama al SEPE')
          throw new SinFicha()
        }

        if (restante === 0) return
        if (reloj.ahora() + restante > limite) throw new SinFicha()
        await reloj.esperar(restante)
      }
    },

    async anotar(respuesta) {
      if (respuesta === 'buena') {
        await almacen.guardar(VACIOS, 0, MEMORIA_DE_LOS_VACIOS_MS)
        return
      }
      await almacen.sumarUno(VACIOS, MEMORIA_DE_LOS_VACIOS_MS)
    },
  }
}
