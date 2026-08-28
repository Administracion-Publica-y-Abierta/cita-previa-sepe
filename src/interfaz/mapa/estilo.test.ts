import { describe, expect, it } from 'vitest'
import {
  APAGADO_SIN_HUECO,
  CAPA_CODIGO_POSTAL,
  CAPA_GRUPOS,
  CAPA_OFICINAS,
  CAPA_RESALTADA,
  capasDelMapa,
  fuenteDeLaResaltada,
  fuenteDeOficinas,
  MAPA_DE_FONDO,
  VERDE_CON_HUECO,
} from './estilo'
import { comoGeoJson, type Punto } from './puntos'

/**
 * El mapa se describe con datos —fuentes, capas, filtros— y es MapLibre quien
 * los pinta. Aquí se prueban esos datos, que es lo único que este proyecto
 * decide: sin tarjeta gráfica no hay forma de comprobar el dibujo, pero sí de
 * comprobar que se le pide lo que se quería.
 */

describe('el mapa de fondo', () => {
  it('no lleva ninguna clave de API', () => {
    // Es la razón por la que se eligió: sin clave no hay tarjeta, ni cuota que
    // se agote un lunes, ni un proveedor del que dependa un servicio público.
    expect(MAPA_DE_FONDO).toMatch(/^https:\/\//)
    expect(MAPA_DE_FONDO).not.toMatch(/key|token|apikey/i)
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
    const codigoPostal = porId(CAPA_CODIGO_POSTAL)

    expect(codigoPostal).toBeTruthy()
    expect(JSON.stringify(codigoPostal)).not.toContain(VERDE_CON_HUECO)
    expect(JSON.stringify(codigoPostal)).not.toContain(APAGADO_SIN_HUECO)
  })

  it('tienen un identificador distinto cada una', () => {
    expect(new Set(capas.map((capa) => capa.id)).size).toBe(capas.length)
  })
})

describe('la oficina resaltada', () => {
  const punto: Punto = { id: 5079, lng: 2.289705, lat: 41.594542, conHueco: true }

  it('se dibuja aunque su grupo esté sin abrir', () => {
    // Sale de una fuente propia y **sin agrupar**. Si saliera de la de las
    // oficinas, una oficina metida dentro de un grupo no existiría como punto
    // suelto y pasar por su tarjeta no resaltaría nada, sin avisar.
    const fuente = fuenteDeLaResaltada(punto)

    expect(fuente.data.features).toHaveLength(1)
    expect(fuente.data.features[0].id).toBe(5079)
    expect(fuente).not.toHaveProperty('cluster')
  })

  it('sin ninguna señalada no se dibuja ninguna', () => {
    expect(fuenteDeLaResaltada(null).data.features).toEqual([])
  })

  it('se dibuja por encima de los puntos y de los grupos, o no se vería', () => {
    const ids = capasDelMapa().map((capa) => capa.id)

    expect(ids.indexOf(CAPA_RESALTADA)).toBeGreaterThan(ids.indexOf(CAPA_OFICINAS))
    expect(ids.indexOf(CAPA_RESALTADA)).toBeGreaterThan(ids.indexOf(CAPA_GRUPOS))
  })
})
