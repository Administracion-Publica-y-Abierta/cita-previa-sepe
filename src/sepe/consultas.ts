import type { Almacen } from '@/almacen/almacen'
import type { AnchoDeClave, Configuracion } from '@/nucleo/configuracion'
import type { Reloj } from '@/nucleo/reloj'
import type { Canal } from './mapa'
import type { OficinaDelSepe } from './oficinas'

/**
 * Cómo le ha ido la consulta al SEPE. Los cuatro son distintos a propósito y
 * la interfaz los pinta distinto.
 *
 * `sin-agenda` es información y `sepe-no-responde` es una avería: está medido
 * que el mismo trámite devuelve vacío y 46 oficinas con treinta segundos de
 * diferencia, así que confundirlos es mentir. `vuelve-en-un-momento` no es del
 * SEPE sino nuestro: significa que había cola en el freno y que no se ha
 * llamado. Ojo con la frontera de `ok`: `ok` con la lista vacía es una
 * respuesta buena en la que no había oficinas, y eso **no** es `sin-agenda`.
 */
export type EstadoDeLaConsulta = 'ok' | 'sin-agenda' | 'sepe-no-responde' | 'vuelve-en-un-momento'

/**
 * Lo que contestó el SEPE, sin nada de quien preguntó.
 *
 * Las oficinas se guardan **crudas**, tal cual vienen. La distancia no entra
 * aquí porque no es del SEPE sino de cada uno: es lo que permite que una
 * entrada compartida por toda una provincia le conteste a cada persona con sus
 * kilómetros.
 */
export interface Consultado {
  estado: EstadoDeLaConsulta
  /** Instante real de la consulta al SEPE, para poder decir de cuándo es el dato. */
  consultadoEn: number
  /**
   * El canal por el que se atienden estas oficinas. Es del SEPE, así que se
   * guarda con ellas: la lista guardada no se puede leer sin saber de qué
   * canal es.
   *
   * No entra en la clave: el canal no lo elige quien pregunta —se coge el que
   * el SEPE lista primero—, así que es parte de la respuesta y no de la
   * pregunta. El día que se pueda elegir, entra.
   */
  canal: Canal | null
  oficinas: OficinaDelSepe[]
}

export interface Servido extends Consultado {
  /** No se ha llamado al SEPE: esto ya estaba guardado. */
  desdeCache: boolean
  /** Se sirve pasado su TTL porque el SEPE no contestaba. La interfaz lo dice. */
  caducada: boolean
}

export interface ClaveDeConsulta {
  codigoPostal: string
  idTramite: number
}

export interface CacheDeConsultas {
  /**
   * Lo que el SEPE contestó para esta consulta: de lo guardado si todavía
   * vale, y si no preguntándoselo.
   */
  obtener(clave: ClaveDeConsulta, consultar: () => Promise<Consultado>): Promise<Servido>
}

/** Cada cuánto mira si el que consulta ya ha terminado. */
const SONDEO_MS = 250

/**
 * Lo que se espera a que conteste quien está consultando.
 *
 * Del mismo orden que el plazo del freno, y por lo mismo: pasado eso, quien
 * pregunta ya se ha ido. Se contesta con lo viejo o se le pide que vuelva.
 */
const PLAZO_DE_ESPERA_MS = 15_000

/**
 * Cuánto puede tardar una consulta antes de dar por muerto al que la lanzó.
 *
 * Media hora de reloj sería un cerrojo eterno si la invocación se cae a medias;
 * treinta segundos es más de lo que tarda una consulta con el freno normal y
 * poco para quedarse esperando a un fantasma.
 */
const MAXIMO_DE_UNA_CONSULTA_MS = 30_000

/**
 * La caché compartida de consultas al SEPE.
 *
 * Hace tres cosas que solo tienen sentido juntas:
 *
 * - **Guardar con TTL**: dentro de la ventana, N visitantes son una consulta.
 * - **Single-flight de verdad**, con un cerrojo en el almacén y no con una
 *   variable de este proceso: dos peticiones iguales a la vez consultan una
 *   sola vez **aunque caigan en invocaciones distintas**, que es el caso que
 *   una promesa guardada en memoria no cubre.
 * - **Servir viejo antes que fallar**: si el SEPE se cae, la última respuesta
 *   buena marcada como vieja es mejor que una pantalla de error.
 */
export function crearCacheDeConsultas(piezas: {
  almacen: Almacen
  reloj: Reloj
  configuracion: Configuracion
}): CacheDeConsultas {
  const { almacen, reloj, configuracion } = piezas

  /**
   * La edad se mide desde que se le preguntó al SEPE y no desde que se guardó
   * la respuesta. El almacén la borra sola al vencer el TTL, pero esos dos
   * instantes no son el mismo —entre la consulta y la escritura pasa lo que
   * pasa— y lo que hay que prometer es lo primero.
   */
  function fresca(guardada: Consultado): boolean {
    return reloj.ahora() - guardada.consultadoEn < configuracion.ttlMs
  }

  /**
   * Se intenta el cerrojo, y si el almacén no contesta se sigue adelante.
   *
   * Aquí fallar abierto no hace daño: como mucho dos invocaciones consultan lo
   * mismo. El que no puede fallar abierto es el freno, y no lo hace: sin
   * almacén no reparte fichas, y sin ficha no se llama al SEPE.
   */
  async function tomarElCerrojo(cerrojo: string): Promise<boolean> {
    try {
      return (await almacen.reservar(cerrojo, MAXIMO_DE_UNA_CONSULTA_MS)) === 0
    } catch {
      return true
    }
  }

  function servir(consultado: Consultado, desdeCache: boolean, caducada = false): Servido {
    return { ...consultado, desdeCache, caducada }
  }

  /**
   * Cuando la consulta de ahora no ha salido bien, la última buena que haya,
   * marcada como vieja.
   *
   * Sale de su propia clave y no de la de la última respuesta. La diferencia
   * importa: está medido que el mismo trámite devuelve vacío y 46 oficinas con
   * treinta segundos de diferencia, así que si las dos compartieran sitio, un
   * solo vacío de paso se llevaría por delante lo único de lo que se puede
   * tirar cuando el SEPE se cae de verdad.
   */
  async function respaldo(fallida: Consultado, clave: string): Promise<Servido> {
    const buena = await almacen.leer<Consultado>(claveDeLaBuena(clave))
    if (buena) return servir(buena, true, true)
    return servir(fallida, false)
  }

  /**
   * Espera a que termine quien tiene el cerrojo, mirando si aparece su
   * respuesta.
   *
   * Cualquier entrada fresca que aparezca aquí es necesariamente la suya: al
   * llegar a este punto ya se había comprobado que no había ninguna, y el
   * tiempo solo va hacia delante.
   */
  async function esperarAlQueConsulta(clave: string, cerrojo: string): Promise<Servido> {
    const limite = reloj.ahora() + PLAZO_DE_ESPERA_MS

    for (;;) {
      await reloj.esperar(SONDEO_MS)

      const recien = await almacen.leer<Consultado>(clave)
      if (recien && fresca(recien)) return servir(recien, true)

      // Si ya nadie está consultando y no ha aparecido nada, al que consultaba
      // le ha ido mal: esperar más no lo va a arreglar.
      if ((await almacen.leer(cerrojo)) === null) break
      if (reloj.ahora() >= limite) break
    }

    return respaldo({ estado: 'vuelve-en-un-momento', consultadoEn: reloj.ahora(), canal: null, oficinas: [] }, clave)
  }

  return {
    async obtener(consulta, consultar) {
      const clave = claveDe(consulta, configuracion.anchoDeClave)
      const cerrojo = `${clave}:consultando`

      const guardada = await almacen.leer<Consultado>(clave)
      if (guardada && fresca(guardada)) return servir(guardada, true)

      if (!(await tomarElCerrojo(cerrojo))) return esperarAlQueConsulta(clave, cerrojo)

      try {
        const consultado = await consultar()

        // Se guarda lo que el SEPE haya contestado, incluido el vacío: un
        // `sin-agenda` es una respuesta suya, y repetirla mientras dure el TTL
        // es lo que evita insistirle cuando ya está diciendo que no puede.
        // Una avería no se guarda: no es una respuesta.
        if (consultado.estado === 'ok' || consultado.estado === 'sin-agenda') {
          await almacen.guardar(clave, consultado, configuracion.ttlMs)
          // La buena, además, aparte y para mucho más rato: es el respaldo del
          // día que el SEPE no conteste, y ni un vacío ni otra consulta más
          // reciente pueden llevársela por delante.
          if (consultado.estado === 'ok') {
            await almacen.guardar(claveDeLaBuena(clave), consultado, configuracion.vidaMaximaMs)
          }
          return servir(consultado, false)
        }

        return respaldo(consultado, clave)
      } finally {
        await almacen.olvidar(cerrojo)
      }
    },
  }
}

/**
 * Con qué se agrupan las consultas. El ancho lo decide la configuración, y por
 * eso ensancharlo a provincia es cambiar un valor y no tocar esto.
 */
function claveDe({ codigoPostal, idTramite }: ClaveDeConsulta, ancho: AnchoDeClave): string {
  const zona = ancho === 'provincia' ? codigoPostal.slice(0, 2) : codigoPostal
  return `consulta:${zona}:${idTramite}`
}

/** Donde vive la última respuesta buena, que dura más que la última a secas. */
function claveDeLaBuena(clave: string): string {
  return `${clave}:buena`
}
