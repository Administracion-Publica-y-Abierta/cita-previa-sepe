import type { AddLayerObject } from 'maplibre-gl'
import type { Coordenadas } from '@/localizacion/distancia'
import type { OficinasEnElMapa } from './puntos'

/**
 * El mapa, descrito como datos.
 *
 * MapLibre se configura con fuentes, capas y filtros que son objetos planos, y
 * eso es una suerte: sin tarjeta gráfica no hay forma de comprobar el dibujo,
 * pero sí de comprobar que se le ha pedido lo que se quería. Todo lo que este
 * proyecto decide sobre el mapa está aquí y se prueba en `estilo.test.ts`.
 */

/**
 * OpenFreeMap: teselas vectoriales de OpenStreetMap, gratis y **sin clave de
 * API**. Es la decisión de fondo y no un detalle: sin clave no hay tarjeta que
 * dar, ni cuota que se agote un lunes por la mañana, ni un proveedor de pago
 * del que dependa una web de servicio público.
 */
export const BASEMAP = 'https://tiles.openfreemap.org/styles/bright'

export const FUENTE_OFICINAS = 'oficinas'
export const FUENTE_CODIGO_POSTAL = 'codigo-postal'

export const CAPA_GRUPOS = 'grupos'
export const CAPA_GRUPOS_NUMERO = 'grupos-numero'
export const CAPA_OFICINAS = 'oficinas'
export const CAPA_RESALTADA = 'oficina-resaltada'
export const CAPA_CODIGO_POSTAL = 'codigo-postal'

/**
 * El color no es lo único que separa con hueco de sin hueco —en la lista lo
 * hace la primera palabra de la línea—, pero en el mapa es lo que se ve de un
 * vistazo, que es para lo que está el mapa.
 */
export const VERDE_CON_HUECO = '#15803d'
export const APAGADO_SIN_HUECO = '#6b7280'

/** El código postal buscado. Azul y con forma propia: no es una oficina. */
const AZUL_CODIGO_POSTAL = '#1d4ed8'

/** El anillo de la oficina por la que se está pasando en la lista. */
const ANILLO_RESALTADA = '#111827'

const BLANCO = '#ffffff'

/** La fuente del basemap, que ya la trae el estilo. */
const FUENTE_DE_TEXTO = ['Noto Sans Bold']

export interface FuenteDeOficinas {
  type: 'geojson'
  data: OficinasEnElMapa
  cluster: boolean
  clusterMaxZoom: number
  clusterRadius: number
  clusterProperties: { conHueco: unknown[] }
}

/**
 * Las oficinas, agrupadas cuando se solapan.
 *
 * Cada grupo lleva la cuenta de cuántas de las suyas tienen hueco: sin eso un
 * grupo sería una bola gris con un número dentro y habría que abrirlo para
 * saber si hay algo que mirar, que es justo el trabajo que el mapa ahorra.
 */
export function fuenteDeOficinas(datos: OficinasEnElMapa): FuenteDeOficinas {
  return {
    type: 'geojson',
    data: datos,
    cluster: true,
    // Por encima de este zoom se ven los puntos uno a uno: a esa escala ya no
    // se solapan y agruparlos escondería oficinas distintas bajo una bola.
    clusterMaxZoom: 13,
    clusterRadius: 45,
    clusterProperties: { conHueco: ['+', ['case', ['get', 'conHueco'], 1, 0]] },
  }
}

export interface FuenteDelCodigoPostal {
  type: 'geojson'
  data: {
    type: 'FeatureCollection'
    features: { type: 'Feature'; geometry: { type: 'Point'; coordinates: [number, number] }; properties: null }[]
  }
}

/** Dónde cae el código postal buscado, o nada si no se ha podido situar. */
export function fuenteDelCodigoPostal(donde: Coordenadas | null): FuenteDelCodigoPostal {
  return {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: donde
        ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [donde.lng, donde.lat] }, properties: null }]
        : [],
    },
  }
}

/**
 * Las capas, en el orden en que se dibujan: lo de abajo primero.
 *
 * El anillo de la resaltada va después de los puntos porque si no quedaría
 * debajo y no se vería, y el código postal va el último porque es el punto de
 * referencia: taparlo con una oficina deja a quien mira sin saber respecto a
 * qué está mirando.
 */
export function capasDelMapa(): AddLayerObject[] {
  return [
    {
      id: CAPA_GRUPOS,
      type: 'circle',
      source: FUENTE_OFICINAS,
      filter: ['has', 'point_count'],
      paint: {
        // Verde si dentro hay alguna con hueco. Un grupo entero sin huecos se
        // ve apagado, igual que una oficina sin hueco.
        'circle-color': ['case', ['>', ['get', 'conHueco'], 0], VERDE_CON_HUECO, APAGADO_SIN_HUECO],
        'circle-radius': ['step', ['get', 'point_count'], 16, 5, 21, 15, 27],
        'circle-stroke-color': BLANCO,
        'circle-stroke-width': 2,
        'circle-opacity': 0.9,
      },
    },
    {
      id: CAPA_GRUPOS_NUMERO,
      type: 'symbol',
      source: FUENTE_OFICINAS,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': FUENTE_DE_TEXTO,
        'text-size': 13,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': BLANCO },
    },
    {
      id: CAPA_OFICINAS,
      type: 'circle',
      source: FUENTE_OFICINAS,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['case', ['get', 'conHueco'], VERDE_CON_HUECO, APAGADO_SIN_HUECO],
        'circle-radius': 8,
        'circle-stroke-color': BLANCO,
        'circle-stroke-width': 2,
      },
    },
    {
      id: CAPA_RESALTADA,
      type: 'circle',
      source: FUENTE_OFICINAS,
      filter: false,
      paint: {
        'circle-color': 'rgba(0, 0, 0, 0)',
        'circle-radius': 14,
        'circle-stroke-color': ANILLO_RESALTADA,
        'circle-stroke-width': 3,
      },
    },
    {
      id: CAPA_CODIGO_POSTAL,
      type: 'circle',
      source: FUENTE_CODIGO_POSTAL,
      paint: {
        'circle-color': AZUL_CODIGO_POSTAL,
        'circle-radius': 7,
        'circle-stroke-color': BLANCO,
        'circle-stroke-width': 3,
      },
    },
  ]
}

/** El filtro que deja pasar solo la oficina resaltada. */
export type FiltroDeResaltada = false | ['==', ['get', 'id'], number]

/**
 * `false` cuando no hay ninguna, y no un identificador imposible: un
 * identificador imposible deja de serlo el día que el SEPE reutilice el número.
 */
export function filtroDeResaltada(id: number | null): FiltroDeResaltada {
  return id === null ? false : ['==', ['get', 'id'], id]
}
