import type { Coordenadas } from '@/localizacion/distancia'
import type { SesionSepe } from './cliente'
import type { OficinaDelSepe } from './oficinas'

/**
 * Los dos endpoints del mapa del SEPE, y todo lo que hay que saber de su forma:
 * cómo se llaman, qué parámetros piden y cuál de los dos hace falta.
 *
 * Está aparte del buscador porque cambian por motivos distintos: esto cambia
 * cuando el SEPE cambia, y el buscador cuando cambia lo que enseñamos.
 */

/** Nodo raíz del árbol de trámites. El SEPE lo manda en todas las llamadas del mapa. */
const JERARQUIA = 5

interface RespuestaDelMapa {
  listTipoAtencion?: { idTipoAtencion: number }[]
  listaOficina?: OficinaDelSepe[]
}

export interface PeticionDelMapa {
  idTramite: number
  codigoPostal: string
  /** Las coordenadas del código postal: el SEPE las quiere en la petición. */
  origen: Coordenadas
}

/**
 * Las oficinas de un trámite, en **una** llamada siempre que se pueda.
 *
 * Aquí se paga la deuda del prototipo: `cargaTiposAtencionMapa` ya devuelve
 * `listaOficina` con todo lo necesario, y el prototipo tiraba esa lista para
 * volver a pedirla con `cargaOficinasMapa`. Eran 2,5 segundos regalados por
 * trámite —el freno— y una petición más al SEPE por cada consulta.
 */
export async function oficinasDelTramite(
  sesion: SesionSepe,
  peticion: PeticionDelMapa,
): Promise<OficinaDelSepe[]> {
  const comunes = parametrosComunes(peticion)

  // `codigoEntidad` va con valor aquí y vacío en la otra llamada. No es un
  // descuido: es lo que manda el SEPE en las capturas, y no se toca.
  const mapa = await sesion.json<RespuestaDelMapa>('/cita/cargaTiposAtencionMapa', {
    codigoEntidad: 'SEPE',
    ...comunes,
  })

  if (mapa.listaOficina?.length) return mapa.listaOficina

  // Algunos trámites sí contestan con la lista vacía y sus oficinas solo salen
  // por la segunda puerta. Es el único caso en que se paga la segunda llamada.
  // El canal es el primero que lista el SEPE, que es el que su propia web trae
  // elegido. Preferir aquí el presencial sería decidir por quien pregunta, y
  // esa decisión es del filtro de trámites, no de la llamada.
  const idTipoAtencion = mapa.listTipoAtencion?.[0]?.idTipoAtencion
  if (idTipoAtencion === undefined) return []

  const oficinas = await sesion.json<RespuestaDelMapa>('/cita/cargaOficinasMapa', {
    codigoEntidad: '',
    idTipoAtencion,
    idTipoAtencionTR: 0,
    ...comunes,
  })

  return oficinas.listaOficina ?? []
}

function parametrosComunes({ idTramite, codigoPostal, origen }: PeticionDelMapa) {
  return {
    idGrupoServicio: idTramite,
    codigoPostal,
    latOrigen: origen.lat,
    lngOrigen: origen.lng,
    tieneTramiteRelacionado: 0,
    idsJerarquiaTramites: JERARQUIA,
  }
}
