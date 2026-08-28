import type { Localizacion } from '@/localizacion/geocodificador'
import type { Buscador, EstadoDeLaBusqueda } from './buscador'
import type { ArbolDeTramites, Catalogo } from './catalogo'
import type { Subtramite } from './niveles'
import type { Oficina } from './oficinas'

/**
 * Lo primero que ve quien llega: las oficinas del primer trámite que el SEPE
 * ofrece en su zona, sin haber elegido nada.
 *
 * Existe porque el hero pide un código postal y **solo** un código postal.
 * Obligar a elegir trámite antes de enseñar nada es pedirle a quien pregunta
 * que sepa cómo llama el SEPE a lo suyo justo cuando aún no lo sabe; el filtro
 * de trámites llega después (issue #10), cuando ya hay algo delante que mirar.
 *
 * Cuál es «el primero» no lo decide una lista nuestra: es el orden en que el
 * SEPE lista su propio árbol, que es el mismo que quien pregunta verá luego en
 * la sede. Cablear aquí un trámite preferido sería volver al diccionario fijo
 * que `CONTRIBUTING.md` señala como fuente de averías silenciosas.
 */

/**
 * Los tres estados de la búsqueda más uno propio: puede que el árbol esté bien
 * y aun así no haya nada que consultar.
 *
 * `sin-tramites` es información y no una avería, igual que `sin-agenda`: el
 * SEPE ha contestado, y lo que dice es que en esa zona no ofrece ningún
 * trámite con cita. La interfaz lo pinta distinto de un SEPE caído porque
 * volver a intentarlo no va a cambiar nada.
 */
export type EstadoDelPrimerTramite = EstadoDeLaBusqueda | 'sin-tramites'

export interface BusquedaDelPrimerTramite {
  estado: EstadoDelPrimerTramite
  /** Instante real de la consulta al SEPE, para poder decir de cuándo es el dato. */
  consultadoEn: number
  /**
   * El trámite consultado, con el nombre que le da el SEPE. `null` cuando no
   * se ha llegado a elegir ninguno.
   *
   * No es un adorno: la lista son las oficinas *de algo*, y quien pregunta no
   * ha elegido ese algo. Sin decir cuál es, la lista no se puede leer.
   */
  tramite: Subtramite | null
  /** De dónde salen los kilómetros, y con cuánta confianza. `null` si no se llegó a buscar. */
  localizacion: Localizacion | null
  oficinas: Oficina[]
}

export interface BuscadorDelPrimerTramite {
  buscar(codigoPostal: string): Promise<BusquedaDelPrimerTramite>
}

/**
 * El primer trámite consultable del árbol, recorriéndolo en el orden en que lo
 * manda el SEPE.
 *
 * Consultable quiere decir de nivel 3: es el único nivel cuyo identificador
 * entiende el mapa. Los trámites cuyo combo viene vacío —un caso real— se
 * saltan en vez de parar la búsqueda: pararse en el primero dejaría el hero en
 * blanco teniendo trámites detrás.
 */
export function primerTramiteDe(arbol: ArbolDeTramites): Subtramite | null {
  for (const rama of arbol.ramas) {
    for (const tramite of rama.tramites) {
      const [primero] = tramite.subtramites
      if (primero) return primero
    }
  }
  return null
}

export function crearBuscadorDelPrimerTramite(piezas: {
  catalogo: Catalogo
  buscador: Buscador
}): BuscadorDelPrimerTramite {
  const { catalogo, buscador } = piezas

  return {
    async buscar(codigoPostal: string): Promise<BusquedaDelPrimerTramite> {
      const arbol = await catalogo.de(codigoPostal)

      // Un árbol que no está `ok` no trae trámites, y elegir «el primero» de
      // una lista que se sabe incompleta sería consultar cualquier cosa. El
      // estado del catálogo sale tal cual: la avería es suya.
      if (arbol.estado !== 'ok') return sinBuscar(arbol.estado, arbol.consultadoEn)

      const tramite = primerTramiteDe(arbol)
      if (!tramite) return sinBuscar('sin-tramites', arbol.consultadoEn)

      const busqueda = await buscador.buscar({ codigoPostal, idTramite: tramite.id })
      return { ...busqueda, tramite }
    },
  }
}

/** Lo que se devuelve cuando no se ha llegado a preguntarle al mapa. */
function sinBuscar(estado: EstadoDelPrimerTramite, consultadoEn: number): BusquedaDelPrimerTramite {
  return { estado, consultadoEn, tramite: null, localizacion: null, oficinas: [] }
}
