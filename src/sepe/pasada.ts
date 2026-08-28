import type { Geocodificador, Localizacion } from '@/localizacion/geocodificador'
import type { Reloj } from '@/nucleo/reloj'
import type { Buscador } from './buscador'
import type { ColaDeTramites, EstadoDeLaCola, TramiteEnCola } from './cola'
import type { EstadoDeLaConsulta } from './consultas'
import type { Canal } from './mapa'
import type { Oficina } from './oficinas'

/**
 * La pasada: consultar los trámites de una zona **uno detrás de otro**, y
 * contar cada uno en cuanto se sabe.
 *
 * Es la respuesta al número que manda en este proyecto: el freno de 2,5 s no
 * se negocia, así que nueve trámites son unos 44 segundos. Nadie mira una
 * pantalla 44 segundos, y ninguna función serverless debe intentarlo. Por eso
 * esto no devuelve un resultado sino que va soltando eventos: el mapa aparece
 * con el primero y los demás entran según llegan.
 *
 * Y por eso también **una pasada no cabe en una invocación**. Cuando se acaba
 * el presupuesto, lo que falte sale en un evento `pendientes` y lo continúa la
 * invocación siguiente. No es sondeo repetido: cada petición trae resultados
 * de verdad y ninguna pregunta «¿ya está?».
 */

/**
 * Lo que una invocación se permite gastar antes de cerrar la respuesta y dejar
 * lo que falte para la siguiente.
 *
 * Veinticinco segundos por aritmética, no por gusto: el techo de una función
 * son sesenta, un trámite empezado dentro del presupuesto puede tardar todavía
 * los quince del plazo del freno más lo que tarde el SEPE en contestar, y esa
 * suma tiene que caber. Bajarlo parte la pasada en más trozos; subirlo la deja
 * a merced de que la invocación se corte a la mitad de un trámite.
 */
export const PRESUPUESTO_DE_LA_INVOCACION_MS = 25_000

/**
 * Un evento de la pasada. Cuatro formas, y cada una contesta a una pregunta
 * distinta de quien mira la pantalla.
 */
export type EventoDeLaPasada =
  /** Qué hay que consultar en esta zona y desde dónde se miden los kilómetros. */
  | {
      tipo: 'cola'
      estado: EstadoDeLaCola
      consultadoEn: number
      localizacion: Localizacion
      tramites: TramiteEnCola[]
    }
  /**
   * Se está preguntando por este trámite. Sale **antes** de la espera, que es
   * lo que hace que la pantalla no parezca colgada mientras dura.
   */
  | { tipo: 'consultando'; idTramite: number; nombreTramite: string }
  /** Un trámite resuelto: sus oficinas y cómo le ha ido. */
  | {
      tipo: 'tramite'
      idTramite: number
      nombreTramite: string
      canal: Canal | null
      /** Instante real de la consulta al SEPE, para poder decir de cuándo es el dato. */
      consultadoEn: number
      /** No se ha llamado al SEPE: la respuesta ya estaba guardada. */
      desdeCache: boolean
      /** Lo guardado ha pasado su TTL y se sirve igual porque el SEPE no contesta. */
      caducada: boolean
      estado: EstadoDeLaConsulta
      oficinas: Oficina[]
    }
  /** Lo que no ha cabido en esta invocación. Quien escucha vuelve a pedir eso. */
  | { tipo: 'pendientes'; tramites: TramiteEnCola[] }

export interface PeticionDeLaPasada {
  codigoPostal: string
  /**
   * Los trámites que se consultan, cuando esto continúa una pasada.
   * **Identificadores y nada más**: los nombres los pone la cola, que los ha
   * sacado del SEPE. Sin esto, un nombre llegado en una petición saldría
   * devuelto en la respuesta.
   *
   * Sin la lista se consulta la zona entera, que es lo que pide el hero.
   */
  idsTramites?: number[]
}

export interface Pasada {
  eventos(peticion: PeticionDeLaPasada): AsyncGenerator<EventoDeLaPasada>
}

export function crearPasada(piezas: {
  geocodificador: Geocodificador
  colaDeTramites: ColaDeTramites
  buscador: Buscador
  reloj: Reloj
}): Pasada {
  const { geocodificador, colaDeTramites, buscador, reloj } = piezas

  return {
    async *eventos({ codigoPostal, idsTramites }: PeticionDeLaPasada): AsyncGenerator<EventoDeLaPasada> {
      // El presupuesto se cuenta desde aquí y no desde que hay cola: descubrir
      // el catálogo son diez peticiones frenadas y es justo la parte cara. Si
      // el reloj empezara después, una zona sin cola guardada se comería el
      // catálogo **más** el presupuesto entero, que es más de lo que aguanta la
      // invocación.
      const limite = reloj.ahora() + PRESUPUESTO_DE_LA_INVOCACION_MS

      // Primero la localización: sus coordenadas viajan en la petición al SEPE
      // y además son la referencia de todas las distancias.
      const localizacion = await geocodificador.localizar(codigoPostal)
      const cola = await colaDeTramites.de(codigoPostal)

      // La cola entera y no solo lo que toca ahora: es lo que hay en la zona, y
      // quien escucha necesita el total para poder decir cuánto falta.
      yield {
        tipo: 'cola',
        estado: cola.estado,
        consultadoEn: cola.consultadoEn,
        localizacion,
        tramites: cola.tramites,
      }

      const porConsultar = idsTramites
        ? cola.tramites.filter((tramite) => idsTramites.includes(tramite.id))
        : cola.tramites

      for (const [hechos, tramite] of porConsultar.entries()) {
        // El primero se consulta siempre, aunque el presupuesto ya esté
        // gastado. No es una concesión: descubrir el catálogo puede habérselo
        // comido entero, y una invocación que no consultara ninguno dejaría a
        // la siguiente exactamente donde estaba. La pasada no avanzaría nunca.
        if (hechos > 0 && reloj.ahora() >= limite) {
          yield { tipo: 'pendientes', tramites: porConsultar.slice(hechos) }
          return
        }

        yield { tipo: 'consultando', idTramite: tramite.id, nombreTramite: tramite.nombre }

        // Lo que el SEPE haga mal —sin agenda, caído, o cola en el freno— sale
        // del buscador como estado y no como excepción, y por eso un trámite
        // que va mal no se lleva por delante a los que vienen detrás.
        const busqueda = await buscador.buscar({ codigoPostal, idTramite: tramite.id })

        yield {
          tipo: 'tramite',
          idTramite: tramite.id,
          nombreTramite: tramite.nombre,
          canal: busqueda.canal,
          consultadoEn: busqueda.consultadoEn,
          desdeCache: busqueda.desdeCache,
          caducada: busqueda.caducada,
          estado: busqueda.estado,
          oficinas: busqueda.oficinas,
        }
      }
    },
  }
}
