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

/**
 * Por dónde se atiende un trámite: presencial, por teléfono. Es del SEPE, y
 * las oficinas que contesta son **las de ese canal**: sin decir cuál, una lista
 * de oficinas no se puede leer del todo.
 */
export interface Canal {
  id: number
  nombre: string
}

interface RespuestaDelMapa {
  listTipoAtencion?: { idTipoAtencion: number; tipoAtencion?: string }[]
  listaOficina?: OficinaDelSepe[]
}

/** Las oficinas de un trámite y el canal por el que se atienden. */
export interface OficinasDelMapa {
  /** `null` cuando el SEPE no ha listado ninguno, que es cuando tampoco hay oficinas. */
  canal: Canal | null
  oficinas: OficinaDelSepe[]
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
): Promise<OficinasDelMapa> {
  const comunes = parametrosComunes(peticion)

  // `codigoEntidad` va con valor aquí y vacío en la otra llamada. No es un
  // descuido: es lo que manda el SEPE en las capturas, y no se toca.
  const mapa = await sesion.json<RespuestaDelMapa>('/cita/cargaTiposAtencionMapa', {
    codigoEntidad: 'SEPE',
    ...comunes,
  })

  // El canal es el primero que lista el SEPE, que es el que su propia web trae
  // elegido. Preferir aquí el presencial sería decidir por quien pregunta, y
  // esa decisión es del filtro de trámites, no de la llamada.
  const canal = canalDe(mapa)

  if (mapa.listaOficina?.length) return { canal, oficinas: mapa.listaOficina }

  // Algunos trámites sí contestan con la lista vacía y sus oficinas solo salen
  // por la segunda puerta. Es el único caso en que se paga la segunda llamada.
  if (!canal) return { canal: null, oficinas: [] }

  const oficinas = await sesion.json<RespuestaDelMapa>('/cita/cargaOficinasMapa', {
    codigoEntidad: '',
    idTipoAtencion: canal.id,
    idTipoAtencionTR: 0,
    ...comunes,
  })

  return { canal, oficinas: oficinas.listaOficina ?? [] }
}

/**
 * El canal de la respuesta, con el nombre que le da el SEPE.
 *
 * Se queda con el nombre vacío si el SEPE no lo manda, en vez de descartar el
 * canal entero: el identificador es lo que necesita la segunda llamada, y sin
 * él no habría oficinas que enseñar. Quien lo pinte decide qué hacer con un
 * nombre en blanco.
 */
function canalDe(mapa: RespuestaDelMapa): Canal | null {
  const primero = mapa.listTipoAtencion?.[0]
  if (!primero) return null
  return { id: primero.idTipoAtencion, nombre: primero.tipoAtencion?.trim() ?? '' }
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
