import { crearGeocodificador, type Geocodificador } from '@/localizacion/geocodificador'
import { crearBuscador, type Buscador } from '@/sepe/buscador'
import { crearCatalogo, type Catalogo } from '@/sepe/catalogo'
import { crearClienteSepe } from '@/sepe/cliente'
import { crearFrenoEnMemoria } from '@/sepe/freno'
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
  /** Código postal → el árbol de trámites que el SEPE ofrece hoy en esa zona. */
  catalogo: Catalogo
  /** Código postal y trámite → oficinas de la zona con su primer hueco. */
  buscador: Buscador
}

export function crearApp(dependencias: Dependencias): App {
  const geocodificador = crearGeocodificador(dependencias)

  // El freno se arma aquí, uno por aplicación, porque el ritmo es de todo el
  // proceso y no de cada búsqueda. Es también el punto por el que entrará el
  // cubo de fichas compartido: en serverless esta memoria no sobrevive entre
  // invocaciones, y dos visitantes a la vez son dos peticiones a la vez.
  const clienteSepe = crearClienteSepe(dependencias.fetch, crearFrenoEnMemoria(dependencias.reloj))

  return {
    dependencias,
    geocodificador,
    // El catálogo comparte cliente con el buscador, y por tanto freno: el
    // ritmo es del proceso entero, y las diez peticiones de un catálogo no
    // pueden colarse por delante de las de una búsqueda que ya iba.
    catalogo: crearCatalogo({ clienteSepe, reloj: dependencias.reloj }),
    buscador: crearBuscador({ clienteSepe, geocodificador, reloj: dependencias.reloj }),
  }
}
