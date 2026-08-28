import type { Geocodificador, Localizacion } from '@/localizacion/geocodificador'
import type { Reloj } from '@/nucleo/reloj'
import { SepeNoResponde, SepeSinAgenda, type ClienteSepe } from './cliente'
import { oficinasDelTramite } from './mapa'
import { aOficina, type Oficina } from './oficinas'

/**
 * Cómo le ha ido a la consulta. Los tres son distintos a propósito y la
 * interfaz los pinta distinto: `sin-agenda` es información y `sepe-no-responde`
 * es una avería. Está medido que el mismo trámite devuelve vacío y 46 oficinas
 * con treinta segundos de diferencia, así que confundirlos es mentir.
 *
 * Ojo con la frontera: `ok` con la lista vacía es una respuesta buena en la que
 * no había oficinas, y eso **no** es `sin-agenda`. `sin-agenda` es el cuerpo
 * vacío, que es el caso medido y el único que el SEPE usa para decir "de esto
 * no te puedo contestar ahora".
 */
export type EstadoDeLaBusqueda = 'ok' | 'sin-agenda' | 'sepe-no-responde'

export interface Busqueda {
  estado: EstadoDeLaBusqueda
  /** Instante real de la consulta al SEPE, para poder decir de cuándo es el dato. */
  consultadoEn: number
  /** De dónde salen los kilómetros, y con cuánta confianza. */
  localizacion: Localizacion
  oficinas: Oficina[]
}

export interface Consulta {
  codigoPostal: string
  idTramite: number
}

export interface Buscador {
  buscar(consulta: Consulta): Promise<Busqueda>
}

export function crearBuscador(piezas: {
  clienteSepe: ClienteSepe
  geocodificador: Geocodificador
  reloj: Reloj
}): Buscador {
  const { clienteSepe, geocodificador, reloj } = piezas

  return {
    async buscar({ codigoPostal, idTramite }: Consulta): Promise<Busqueda> {
      // Primero la localización: sus coordenadas viajan en la petición al SEPE
      // y además son la referencia de todas las distancias.
      const localizacion = await geocodificador.localizar(codigoPostal)

      try {
        const crudas = await clienteSepe.enUnaSesion((sesion) =>
          oficinasDelTramite(sesion, { idTramite, codigoPostal, origen: localizacion }),
        )

        return {
          estado: 'ok',
          consultadoEn: reloj.ahora(),
          localizacion,
          oficinas: crudas.map((cruda) => aOficina(cruda, localizacion)),
        }
      } catch (error) {
        if (error instanceof SepeSinAgenda) return vacia('sin-agenda', localizacion, reloj.ahora())
        if (error instanceof SepeNoResponde) return vacia('sepe-no-responde', localizacion, reloj.ahora())
        // Lo demás sale tal cual: un fallo de red o un fallo nuestro no es una
        // respuesta del SEPE y no debe disfrazarse de una.
        throw error
      }
    },
  }
}

function vacia(estado: EstadoDeLaBusqueda, localizacion: Localizacion, consultadoEn: number): Busqueda {
  return { estado, consultadoEn, localizacion, oficinas: [] }
}
