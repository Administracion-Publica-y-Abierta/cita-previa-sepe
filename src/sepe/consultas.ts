import type { Almacen } from '@/almacen/almacen'
import type { AnchoDeClave, Configuracion } from '@/nucleo/configuracion'
import type { Reloj } from '@/nucleo/reloj'
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

  function fresca(guardada: Consultado): boolean {
    return reloj.ahora() - guardada.consultadoEn < configuracion.ttlMs
  }

  function servir(consultado: Consultado, desdeCache: boolean, caducada = false): Servido {
    return { ...consultado, desdeCache, caducada }
  }

  /**
   * Cuando la consulta de ahora no ha salido bien, lo último bueno que haya,
   * marcado como viejo.
   *
   * Solo sirve de respaldo una respuesta `ok`: un `sin-agenda` de hace media
   * hora no le dice nada a nadie, y disfrazarlo de dato viejo sería peor que
   * reconocer la avería.
   */
  function respaldo(fallida: Consultado, guardada: Consultado | null): Servido {
    if (guardada?.estado === 'ok') return servir(guardada, true, true)
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
  async function esperarAlQueConsulta(
    clave: string,
    cerrojo: string,
    previa: Consultado | null,
  ): Promise<Servido> {
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

    return respaldo({ estado: 'vuelve-en-un-momento', consultadoEn: reloj.ahora(), oficinas: [] }, previa)
  }

  return {
    async obtener(consulta, consultar) {
      const clave = claveDe(consulta, configuracion.anchoDeClave)
      const cerrojo = `${clave}:consultando`

      const guardada = await almacen.leer<Consultado>(clave)
      if (guardada && fresca(guardada)) return servir(guardada, true)

      if ((await almacen.reservar(cerrojo, MAXIMO_DE_UNA_CONSULTA_MS)) > 0) {
        return esperarAlQueConsulta(clave, cerrojo, guardada)
      }

      try {
        const consultado = await consultar()

        // Se guarda lo que el SEPE haya contestado, incluido el vacío: un
        // `sin-agenda` es una respuesta suya y repetirla durante el TTL es
        // justo lo que evita insistirle cuando ya está diciendo que no puede.
        // Una avería no se guarda: taparía la última respuesta buena, que es
        // de lo único que se puede tirar mientras esté caído.
        if (consultado.estado === 'ok' || consultado.estado === 'sin-agenda') {
          await almacen.guardar(clave, consultado, configuracion.vidaMaximaMs)
          return servir(consultado, false)
        }

        return respaldo(consultado, guardada)
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
