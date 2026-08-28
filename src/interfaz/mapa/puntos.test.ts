import { describe, expect, it } from 'vitest'
import type { Oficina } from '@/sepe/oficinas'
import { comoGeoJson, encuadreDe, puntosDe } from './puntos'

/**
 * Lo que el mapa dibuja, sin mapa por medio.
 *
 * Un mapa de WebGL no se puede montar en un test —no hay tarjeta gráfica en
 * CI—, así que lo que aquí se prueba es lo único que puede salir mal en
 * silencio: qué puntos se dibujan y dónde se encuadra la vista. Lo que hace
 * MapLibre con eso es de MapLibre.
 */

function oficina(parcial: Partial<Oficina> = {}): Oficina {
  return {
    id: 1,
    nombre: 'GRANOLLERS-PERIFERIA - SEPE',
    direccion: 'AVDA. MARIE CURIE, 25-27',
    telefono: '0901010210',
    horarioAtencion: '08:30 a 14:00',
    lat: 41.594542,
    lng: 2.289705,
    km: 1.42,
    primerHueco: '2026-08-17T09:00:00',
    idServicio: 631,
    servicio: 'Voy a salir al extranjero',
    oficinaVirtual: false,
    ...parcial,
  }
}

describe('los puntos que van al mapa', () => {
  it('marca cuáles tienen hueco, que es lo que los distingue a simple vista', () => {
    const puntos = puntosDe([
      oficina({ id: 1, primerHueco: '2026-08-17T09:00:00' }),
      oficina({ id: 2, primerHueco: null }),
    ])

    expect(puntos.map((punto) => [punto.id, punto.conHueco])).toEqual([
      [1, true],
      [2, false],
    ])
  })

  it('no dibuja las oficinas que no están en ningún sitio', () => {
    // Una oficina virtual atiende por teléfono o por internet, y el SEPE la
    // manda sin coordenadas de verdad. Dibujarla en el (0, 0) la pone en el
    // golfo de Guinea y arrastra el encuadre del mapa con ella.
    const puntos = puntosDe([
      oficina({ id: 1 }),
      oficina({ id: 2, lat: 0, lng: 0, oficinaVirtual: true }),
      oficina({ id: 3, lat: Number.NaN, lng: Number.NaN }),
    ])

    expect(puntos.map((punto) => punto.id)).toEqual([1])
  })

  it('se escribe como GeoJSON con el identificador de la oficina arriba', () => {
    // El identificador va en el `id` de la característica y también en sus
    // propiedades: el primero es el que usa MapLibre y el segundo el que se
    // puede filtrar para resaltar una oficina.
    const [caracteristica] = comoGeoJson(puntosDe([oficina({ id: 5079 })])).features

    expect(caracteristica.id).toBe(5079)
    expect(caracteristica.properties).toEqual({ id: 5079, conHueco: true })
    expect(caracteristica.geometry).toEqual({ type: 'Point', coordinates: [2.289705, 41.594542] })
  })
})

describe('el encuadre del mapa', () => {
  it('cabe todo lo que hay que ver: las oficinas y el código postal buscado', () => {
    const puntos = puntosDe([
      oficina({ id: 1, lat: 41.5, lng: 2.1 }),
      oficina({ id: 2, lat: 41.7, lng: 2.4 }),
    ])

    const [[oeste, sur], [este, norte]] = encuadreDe(puntos, { lat: 41.4, lng: 2.6 })!

    expect([oeste, sur]).toEqual([2.1, 41.4])
    expect([este, norte]).toEqual([2.6, 41.7])
  })

  it('encuadra las oficinas aunque no se sepa dónde cae el código postal', () => {
    const puntos = puntosDe([oficina({ id: 1, lat: 41.5, lng: 2.1 })])

    expect(encuadreDe(puntos, null)).toEqual([
      [2.1, 41.5],
      [2.1, 41.5],
    ])
  })

  it('sin nada que enseñar no hay encuadre que hacer', () => {
    // Devolver un encuadre inventado dejaría el mapa en mitad del Atlántico:
    // es preferible que quien lo llama no mueva la vista.
    expect(encuadreDe([], null)).toBeNull()
  })
})
