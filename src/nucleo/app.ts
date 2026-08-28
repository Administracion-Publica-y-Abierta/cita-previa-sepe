import type { Almacen } from '@/almacen/almacen'
import { crearGeocodificador, type Geocodificador } from '@/localizacion/geocodificador'
import { crearBuscador, type Buscador } from '@/sepe/buscador'
import { crearCatalogo, type Catalogo } from '@/sepe/catalogo'
import { crearClienteSepe } from '@/sepe/cliente'
import { crearCacheDeConsultas } from '@/sepe/consultas'
import { crearFrenoCompartido } from '@/sepe/freno'
import { crearBuscadorDelPrimerTramite, type BuscadorDelPrimerTramite } from '@/sepe/primer-tramite'
import { CONFIGURACION_POR_DEFECTO, type Configuracion } from './configuracion'
import type { Dependencias } from './dependencias'

/**
 * La aplicación armada: el único sitio donde se juntan las dependencias con
 * las piezas que las usan (cliente SEPE, catálogo, geocodificador, buscador,
 * caché).
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
  /** Código postal a secas → las oficinas del primer trámite. Es lo que pide el hero. */
  primerTramite: BuscadorDelPrimerTramite
}

/**
 * Lo que se le puede cambiar a la aplicación al armarla.
 *
 * **No son costuras nuevas.** Las costuras siguen siendo dos, el `fetch` y el
 * reloj, y son las que dice `Dependencias`. El almacén no es un doble: en los
 * tests se usa el de memoria, que es código de producción —el mismo que corre
 * en local— y el de Redis se construye por encima del `fetch`, o sea de la
 * costura que ya había.
 */
export interface Ajustes {
  /** Dónde vive el estado compartido: el freno y la caché. */
  almacen: Almacen
  /** Lo poco que se ajusta sin tocar código; lo que no se diga, por defecto. */
  configuracion?: Partial<Configuracion>
}

export function crearApp(dependencias: Dependencias, ajustes: Ajustes): App {
  const { fetch, reloj } = dependencias
  const geocodificador = crearGeocodificador(dependencias)
  const { almacen } = ajustes
  const configuracion = { ...CONFIGURACION_POR_DEFECTO, ...ajustes.configuracion }

  // El freno se sostiene en el almacén compartido y no en variables de este
  // proceso: en serverless esa memoria no sobrevive entre invocaciones, y dos
  // visitantes a la vez serían dos peticiones a la vez.
  const clienteSepe = crearClienteSepe(fetch, crearFrenoCompartido({ almacen, reloj }))

  // El catálogo comparte cliente con el buscador, y por tanto freno: el ritmo
  // es de todo el servicio, y las diez peticiones de un catálogo no pueden
  // colarse por delante de las de una búsqueda que ya iba.
  const catalogo = crearCatalogo({ clienteSepe, reloj })
  const buscador = crearBuscador({
    clienteSepe,
    geocodificador,
    reloj,
    cache: crearCacheDeConsultas({ almacen, reloj, configuracion }),
  })

  return {
    dependencias,
    geocodificador,
    catalogo,
    buscador,
    // No es una pieza más: es la composición de las dos de arriba, y se arma
    // aquí para que no haya un Route Handler orquestando por su cuenta.
    primerTramite: crearBuscadorDelPrimerTramite({ catalogo, buscador }),
  }
}
