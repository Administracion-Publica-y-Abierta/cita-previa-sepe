import type { Localizacion } from '@/localizacion/geocodificador'
import type { EstadoDeLaCola } from '@/sepe/cola'
import type { Subtramite } from '@/sepe/niveles'
import type { Oficina } from '@/sepe/oficinas'
import type { EventoDeLaPasada } from '@/sepe/pasada'

/**
 * Lo que la pantalla sabe **hasta ahora** de una búsqueda que todavía está
 * llegando.
 *
 * Vive fuera del componente y sin nada de React dentro por lo mismo que el
 * resumen: una búsqueda ya no es una respuesta que se guarda en un estado, es
 * una sucesión de eventos que se van sumando, y eso conviene poder leerlo —y
 * probarlo— sin montar una pantalla.
 */

/** Un trámite ya resuelto: el evento de la pasada, tal como llegó. */
export type TramiteResuelto = Extract<EventoDeLaPasada, { tipo: 'tramite' }>

/**
 * En qué punto está la búsqueda. `terminada` no quiere decir que haya salido
 * bien: quiere decir que ya no va a llegar nada más.
 */
export type FaseDeLaBusqueda = 'inicial' | 'buscando' | 'terminada' | 'rechazado' | 'sin-conexion'

/** Cómo ha acabado una búsqueda. `abandonada` es que se pidió otra por encima. */
export type FinDeLaBusqueda = 'terminada' | 'rechazado' | 'sin-conexion' | 'abandonada'

export interface LoQueVaLlegando {
  fase: FaseDeLaBusqueda
  /**
   * Cambia con cada búsqueda nueva. Lo mira el mapa para encuadrar una vez por
   * búsqueda y no cada vez que entra un trámite.
   */
  busqueda: number
  localizacion: Localizacion | null
  /** Cómo ha ido descubrir qué trámites hay en la zona. `null` mientras no se sabe. */
  estadoDeLaCola: EstadoDeLaCola | null
  /** Todos los trámites de la zona, en el orden del SEPE. */
  cola: Subtramite[]
  /** El que se está consultando ahora mismo, o `null` entre uno y otro. */
  consultando: Subtramite | null
  /** Lo que ha ido llegando, en el orden en que llegó. */
  resueltos: TramiteResuelto[]
}

export const NADA_TODAVIA: LoQueVaLlegando = {
  fase: 'inicial',
  busqueda: 0,
  localizacion: null,
  estadoDeLaCola: null,
  cola: [],
  consultando: null,
  resueltos: [],
}

/** Una búsqueda recién lanzada: se tira lo de la anterior, que era de otro sitio. */
export function empezando(busqueda: number): LoQueVaLlegando {
  return { ...NADA_TODAVIA, fase: 'buscando', busqueda }
}

/** Lo de antes más lo que acaba de llegar. */
export function con(estado: LoQueVaLlegando, evento: EventoDeLaPasada): LoQueVaLlegando {
  switch (evento.tipo) {
    case 'cola':
      return {
        ...estado,
        localizacion: evento.localizacion,
        estadoDeLaCola: evento.estado,
        cola: evento.tramites,
      }
    case 'consultando':
      return { ...estado, consultando: { id: evento.idTramite, nombre: evento.nombreTramite } }
    case 'tramite':
      return { ...estado, consultando: null, resueltos: [...estado.resueltos, evento] }
    // Lo que falta se lo queda el transporte, que es quien vuelve a pedirlo.
    // Aquí solo cuenta que ahora mismo no se está consultando nada.
    case 'pendientes':
      return { ...estado, consultando: null }
  }
}

export function acabada(estado: LoQueVaLlegando, fin: FaseDeLaBusqueda): LoQueVaLlegando {
  return { ...estado, fase: fin, consultando: null }
}

/** Cuántos trámites quedan por llegar, contando el que se esté consultando. */
export function cuantosFaltan(estado: LoQueVaLlegando): number {
  return Math.max(0, estado.cola.length - estado.resueltos.length)
}

/**
 * Una oficina con el trámite del que es su hueco.
 *
 * Hace falta desde que se consulta más de un trámite: la misma oficina sale en
 * varios, con una hora distinta en cada uno, y una hora sin decir de qué
 * trámite es no sirve para ir a ninguna parte.
 */
export interface OficinaConSuTramite extends Oficina {
  tramite: Subtramite
}

/**
 * Las oficinas de todo lo que ha llegado, cada una una sola vez.
 *
 * Se queda con el hueco **más temprano** de los que haya traído cualquier
 * trámite. Es lo que contesta a la pregunta que trae aquí a la gente —¿cuándo
 * es lo más pronto que me pueden atender cerca?— y por eso la oficina se queda
 * también con el trámite de ese hueco: sin decirlo, la hora no se puede usar.
 *
 * Ordenadas por distancia, que es lo que la lista promete en su nombre.
 */
export function oficinasDe({ resueltos }: LoQueVaLlegando): OficinaConSuTramite[] {
  const porOficina = new Map<number, OficinaConSuTramite>()

  for (const resuelto of resueltos) {
    const tramite = { id: resuelto.idTramite, nombre: resuelto.nombreTramite }
    for (const oficina of resuelto.oficinas) {
      const anterior = porOficina.get(oficina.id)
      if (!anterior || masTemprano(oficina.primerHueco, anterior.primerHueco)) {
        porOficina.set(oficina.id, { ...oficina, tramite })
      }
    }
  }

  return [...porOficina.values()].sort((una, otra) => una.km - otra.km)
}

/**
 * Las horas se comparan como cadenas porque vienen en `2026-08-17T09:00:00`, y
 * ese formato ordena igual escrito que en el tiempo. No tener hueco es peor que
 * cualquier hora, por lejana que sea.
 */
function masTemprano(hueco: string | null, queEste: string | null): boolean {
  if (hueco === null) return false
  return queEste === null || hueco < queEste
}
