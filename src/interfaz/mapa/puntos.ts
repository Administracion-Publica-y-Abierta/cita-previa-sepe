import type { Coordenadas } from '@/localizacion/distancia'
import type { Oficina } from '@/sepe/oficinas'

/**
 * De la lista de oficinas a lo que el mapa sabe dibujar.
 *
 * Está fuera del componente y sin nada de MapLibre dentro porque es la parte
 * que puede equivocarse en silencio —un punto en el sitio que no es, un
 * encuadre que deja fuera media provincia— y la única que se puede probar sin
 * una tarjeta gráfica delante.
 */

/** Una oficina, reducida a lo que el mapa necesita saber de ella. */
export interface Punto {
  id: number
  lng: number
  lat: number
  /** Lo que separa el verde del gris. Se calcula aquí y no en una expresión del estilo. */
  conHueco: boolean
}

/** `[[oeste, sur], [este, norte]]`, que es como lo espera MapLibre. */
export type Encuadre = [[number, number], [number, number]]

/** Los puntos de una lista de oficinas, sin las que no están en ningún sitio. */
export function puntosDe(oficinas: Oficina[]): Punto[] {
  return oficinas.filter(estaEnAlgunSitio).map((oficina) => ({
    id: oficina.id,
    lng: oficina.lng,
    lat: oficina.lat,
    conHueco: oficina.primerHueco !== null,
  }))
}

/**
 * Las oficinas virtuales atienden por teléfono o por internet y el SEPE las
 * manda sin coordenadas. Dibujarlas en el (0, 0) las pone en el golfo de
 * Guinea y se lleva el encuadre del mapa con ellas; en la lista siguen, que es
 * donde tienen sentido.
 */
function estaEnAlgunSitio(oficina: Oficina): boolean {
  if (!Number.isFinite(oficina.lat) || !Number.isFinite(oficina.lng)) return false
  return oficina.lat !== 0 || oficina.lng !== 0
}

/** Un punto en GeoJSON. Solo lo que se usa: MapLibre acepta más de lo que hace falta. */
export interface OficinaEnElMapa {
  type: 'Feature'
  /** Arriba porque es el que mira MapLibre al agrupar y al preguntar por un punto. */
  id: number
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: { id: number; conHueco: boolean }
}

export interface OficinasEnElMapa {
  type: 'FeatureCollection'
  features: OficinaEnElMapa[]
}

/**
 * El identificador va dos veces —arriba y en las propiedades— y no es un
 * descuido: el de arriba es el que usa MapLibre para sus cosas, y el de dentro
 * el único que se puede leer desde un filtro para resaltar una oficina.
 */
export function comoGeoJson(puntos: Punto[]): OficinasEnElMapa {
  return {
    type: 'FeatureCollection',
    features: puntos.map((punto) => ({
      type: 'Feature',
      id: punto.id,
      // GeoJSON va al revés que todo lo demás: longitud primero.
      geometry: { type: 'Point', coordinates: [punto.lng, punto.lat] },
      properties: { id: punto.id, conHueco: punto.conHueco },
    })),
  }
}

/**
 * Lo que hay que ver de una vez: todas las oficinas y el código postal
 * buscado. `null` cuando no hay nada que enseñar, para que quien lo llame deje
 * la vista donde estaba en vez de irse a un encuadre inventado.
 *
 * Un solo punto sale como un rectángulo de lado cero. Es correcto y es cosa de
 * quien encuadra ponerle un zoom máximo: aquí no se puede saber cuánto es
 * "cerca" sin saber el tamaño del mapa.
 */
export function encuadreDe(puntos: Punto[], codigoPostal: Coordenadas | null): Encuadre | null {
  const sitios: Coordenadas[] = [...puntos]
  if (codigoPostal) sitios.push(codigoPostal)
  if (sitios.length === 0) return null

  const longitudes = sitios.map((sitio) => sitio.lng)
  const latitudes = sitios.map((sitio) => sitio.lat)

  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ]
}
