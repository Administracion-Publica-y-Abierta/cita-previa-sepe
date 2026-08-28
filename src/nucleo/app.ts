import { crearGeocodificador, type Geocodificador } from '@/localizacion/geocodificador'
import type { Dependencias } from './dependencias'

/**
 * La aplicación armada: el único sitio donde se juntan las dependencias con
 * las piezas que las usan (cliente SEPE, catálogo, geocodificador, buscador,
 * caché), según vayan existiendo.
 *
 * Que todas cuelguen de aquí es lo que permite que un test monte la
 * aplicación entera con un `fetch` y un reloj falsos y siga ejercitando el
 * código de verdad por encima: parseo, caché, freno y rutas.
 */
export interface App {
  dependencias: Dependencias
  /** Código postal → coordenadas, con el centroide provincial de reserva. */
  geocodificador: Geocodificador
}

export function crearApp(dependencias: Dependencias): App {
  return {
    dependencias,
    geocodificador: crearGeocodificador(dependencias),
  }
}
