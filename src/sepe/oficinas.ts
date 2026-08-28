import { distanciaEnKm, type Coordenadas } from '@/localizacion/distancia'

/**
 * Una oficina tal como la manda el SEPE. Solo se declara lo que se usa: la
 * respuesta trae casi treinta campos, y la mitad son de la parte de reserva.
 */
export interface OficinaDelSepe {
  idOficina: number
  oficina: string
  direccion: string
  telefono: string
  horarioAtencion: string
  latitud: number
  longitud: number
  idServicio: number
  servicio: string
  oficinaVirtual: boolean
  /** `"2026-08-17, 09:00:00"`, o la cadena vacía si no tiene hueco. */
  primerHuecoDisponible: string
}

/** Una oficina como la pinta esta aplicación. */
export interface Oficina {
  id: number
  nombre: string
  direccion: string
  telefono: string
  horarioAtencion: string
  lat: number
  lng: number
  /** Kilómetros desde el código postal consultado, calculados por nosotros. */
  km: number
  /**
   * El primer hueco, en hora local española y sin zona
   * (`"2026-08-17T09:00:00"`). `null` significa que esta oficina no tiene
   * hueco para este trámite, que no es lo mismo que no existir.
   */
  primerHueco: string | null
  idServicio: number
  servicio: string
  oficinaVirtual: boolean
}

/** `"2026-08-17, 09:00:00"`. La coma y el espacio son del SEPE, no un descuido. */
const FORMATO_DEL_SEPE = /^(\d{4}-\d{2}-\d{2}),\s*(\d{2}:\d{2}:\d{2})$/

/**
 * El primer hueco, o `null`.
 *
 * Se queda en hora local sin zona a propósito: lo que el SEPE dice es la hora
 * de pared a la que atiende esa oficina, y pasarla por un `Date` la ataría a
 * la zona del servidor —que en Vercel es UTC— y la enseñaría dos horas antes.
 */
export function primerHuecoDe(crudo: string | undefined): string | null {
  const partes = FORMATO_DEL_SEPE.exec(crudo?.trim() ?? '')
  return partes ? `${partes[1]}T${partes[2]}` : null
}

/**
 * La distancia es nuestra: el `distanciaCP` que manda el SEPE está calculado
 * contra las coordenadas de *esa* petición, y en cuanto una respuesta se sirva
 * de la caché para otro código postal sería la distancia de otra persona.
 */
export function aOficina(cruda: OficinaDelSepe, desde: Coordenadas): Oficina {
  return {
    id: cruda.idOficina,
    nombre: cruda.oficina,
    direccion: cruda.direccion,
    telefono: cruda.telefono,
    horarioAtencion: cruda.horarioAtencion,
    lat: cruda.latitud,
    lng: cruda.longitud,
    km: distanciaEnKm(desde, { lat: cruda.latitud, lng: cruda.longitud }),
    primerHueco: primerHuecoDe(cruda.primerHuecoDisponible),
    idServicio: cruda.idServicio,
    servicio: cruda.servicio,
    oficinaVirtual: cruda.oficinaVirtual,
  }
}
