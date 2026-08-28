import { describe, expect, it } from 'vitest'
import {
  BASEMAP,
  CAPA_RESALTADA,
  capasDelMapa,
  filtroDeResaltada,
  fuenteDeOficinas,
  VERDE_CON_HUECO,
  APAGADO_SIN_HUECO,
} from './estilo'
import { comoGeoJson } from './puntos'

/**
 * El mapa se describe con datos —fuentes, capas, filtros— y es MapLibre quien
 * los pinta. Aquí se prueban esos datos, que es lo único que este proyecto
 * decide: sin tarjeta gráfica no hay forma de comprobar el dibujo, pero sí de
 * comprobar que se le pide lo que se quería.
 */

describe('el basemap', () => {
  it('no lleva ninguna clave de API', () => {
    // Es la razón por la que se eligió: sin clave no hay tarjeta, ni cuota que
    // se agote un lunes, ni un proveedor del que dependa un servicio público.
    expect(BASEMAP).toMatch(/^https:\/\//)
    expect(BASEMAP).not.toMatch(/key|token|apikey/i)
  })
})

describe('la fuente de las oficinas', () => {
  it('agrupa los puntos que se solapan', () => {
    expect(fuenteDeOficinas(comoGeoJson([]))).toMatchObject({ type: 'geojson', cluster: true })
  })

  it('cada grupo sabe cuántas de las suyas tienen hueco', () => {
    // Sin esto un grupo sería una bola gris con un número: no se sabría si hay
    // algo que mirar dentro sin abrirlo, que es justo lo que el mapa evita.
    const fuente = fuenteDeOficinas(comoGeoJson([]))

    expect(fuente.clusterProperties).toHaveProperty('conHueco')
  })
})

describe('las capas', () => {
  const capas = capasDelMapa()
  const porId = (id: string) => capas.find((capa) => capa.id === id)

  it('pintan de otro color las oficinas con hueco', () => {
    expect(VERDE_CON_HUECO).not.toBe(APAGADO_SIN_HUECO)
    expect(JSON.stringify(capas)).toContain(VERDE_CON_HUECO)
    expect(JSON.stringify(capas)).toContain(APAGADO_SIN_HUECO)
  })

  it('marcan el código postal buscado con algo que no es una oficina', () => {
    const codigoPostal = porId('codigo-postal')

    expect(codigoPostal).toBeTruthy()
    expect(JSON.stringify(codigoPostal)).not.toContain(VERDE_CON_HUECO)
    expect(JSON.stringify(codigoPostal)).not.toContain(APAGADO_SIN_HUECO)
  })

  it('tienen un identificador distinto cada una', () => {
    expect(new Set(capas.map((capa) => capa.id)).size).toBe(capas.length)
  })
})

describe('la oficina resaltada', () => {
  it('es la que dice la lista, y solo esa', () => {
    expect(filtroDeResaltada(5079)).toEqual(['==', ['get', 'id'], 5079])
  })

  it('sin ninguna resaltada no resalta ninguna', () => {
    // `false` y no un identificador imposible: un identificador imposible deja
    // de serlo el día que el SEPE reutilice ese número.
    expect(filtroDeResaltada(null)).toEqual(false)
  })

  it('se dibuja por encima de los puntos, o no se vería', () => {
    const ids = capasDelMapa().map((capa) => capa.id)

    expect(ids.indexOf(CAPA_RESALTADA)).toBeGreaterThan(ids.indexOf('oficinas'))
  })
})
