import { exigirProvincia } from '@/localizacion/geocodificador'
import type { Reloj } from '@/nucleo/reloj'
import { SepeNoResponde, SepeSinAgenda, type ClienteSepe } from './cliente'
import { ramasDelCatalogo, type Rama } from './niveles'

/**
 * Los mismos tres estados que la búsqueda, y por el mismo motivo: `sin-agenda`
 * es información y `sepe-no-responde` es una avería, y la interfaz los pinta
 * distinto.
 */
export type EstadoDelCatalogo = 'ok' | 'sin-agenda' | 'sepe-no-responde'

export interface ArbolDeTramites {
  estado: EstadoDelCatalogo
  /** Instante real de la consulta al SEPE, para poder decir de cuándo es el dato. */
  consultadoEn: number
  ramas: Rama[]
}

export interface Catalogo {
  /** El árbol de trámites que el SEPE ofrece hoy en esa zona. */
  de(codigoPostal: string): Promise<ArbolDeTramites>
}

/**
 * El catálogo se descubre entero en cada consulta y no lleva ni un solo
 * identificador escrito a mano.
 *
 * Esto es lo que sustituye al diccionario fijo de trámites del prototipo, que
 * es justo lo que `CONTRIBUTING.md` señala como fuente de averías silenciosas:
 * el SEPE cambia sus identificadores sin avisar, y con la lista escrita a mano
 * la aplicación seguiría preguntando por trámites que ya no existen sin que
 * nadie se enterase.
 *
 * Cuesta lo suyo: una petición para las raíces, una por rama y una por trámite,
 * todas con el freno de por medio. Por eso hay una caché delante (issue #6);
 * lo que no se hace es ahorrárselas cableando los identificadores.
 */
export function crearCatalogo(piezas: { clienteSepe: ClienteSepe; reloj: Reloj }): Catalogo {
  const { clienteSepe, reloj } = piezas

  return {
    async de(codigoPostal: string): Promise<ArbolDeTramites> {
      // Se comprueba antes de salir: no se le pide al SEPE algo que ya se sabe
      // que no vale, y son diez peticiones frenadas las que se ahorran.
      exigirProvincia(codigoPostal)

      try {
        const ramas = await clienteSepe.enUnaSesion((sesion) => ramasDelCatalogo(sesion, codigoPostal))
        return { estado: 'ok', consultadoEn: reloj.ahora(), ramas }
      } catch (error) {
        // El árbol es todo o nada a propósito. Un árbol al que le falta una
        // rama porque el SEPE se atragantó a mitad no se distingue, mirándolo,
        // de un árbol completo: quien buscase su trámite ahí concluiría que no
        // existe. Es preferible decir que el SEPE no contesta y que lo vuelva
        // a pedir.
        if (error instanceof SepeSinAgenda) return vacio('sin-agenda', reloj.ahora())
        if (error instanceof SepeNoResponde) return vacio('sepe-no-responde', reloj.ahora())
        // Lo demás sale tal cual: un fallo de red o un fallo nuestro no es una
        // respuesta del SEPE y no debe disfrazarse de una.
        throw error
      }
    },
  }
}

function vacio(estado: EstadoDelCatalogo, consultadoEn: number): ArbolDeTramites {
  return { estado, consultadoEn, ramas: [] }
}
