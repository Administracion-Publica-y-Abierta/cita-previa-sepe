import { describe, expect, it } from 'vitest'
import { distanciaEnKm } from './distancia'

/**
 * La distancia la calculamos nosotros y no usamos el `distanciaCP` que manda
 * el SEPE. Por eso hay que probarla contra valores conocidos de fuera: si esto
 * se desvía, toda la lista de oficinas sale ordenada mal y nadie se entera.
 *
 * Los tres primeros casos tienen valor analítico exacto sobre la esfera de
 * radio 6371 km, así que no dependen de ninguna medición ajena.
 */
describe('la distancia entre dos puntos', () => {
  it('es cero entre un punto y él mismo', () => {
    expect(distanciaEnKm({ lat: 41.3874, lng: 2.1686 }, { lat: 41.3874, lng: 2.1686 })).toBe(0)
  })

  it('es de 111,19 km por cada grado de longitud sobre el ecuador', () => {
    // π · 6371 / 180
    expect(distanciaEnKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.195, 2)
  })

  it('son 10.007,5 km del ecuador al polo por un meridiano', () => {
    // Un cuarto de meridiano: π · 6371 / 2
    expect(distanciaEnKm({ lat: 0, lng: 0 }, { lat: 90, lng: 0 })).toBeCloseTo(10007.54, 1)
  })

  it('son media circunferencia entre dos puntos antípodas', () => {
    expect(distanciaEnKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(20015.09, 1)
  })

  it('coincide con la distancia conocida entre Madrid y Barcelona', () => {
    // ~505 km en línea recta, que es el dato que da cualquier calculadora de
    // ortodrómica para los dos centros urbanos.
    const km = distanciaEnKm({ lat: 40.4168, lng: -3.7038 }, { lat: 41.3874, lng: 2.1686 })

    expect(km).toBeGreaterThan(500)
    expect(km).toBeLessThan(510)
  })

  it('da lo mismo en un sentido que en el otro', () => {
    const granollers = { lat: 41.6083, lng: 2.2875 }
    const barcelona = { lat: 41.3874, lng: 2.1686 }

    expect(distanciaEnKm(granollers, barcelona)).toBe(distanciaEnKm(barcelona, granollers))
  })

  it('no se va a NaN cuando el coseno se sale del intervalo por redondeo', () => {
    // Dos puntos casi idénticos: es donde una fórmula mal acotada devuelve NaN.
    const km = distanciaEnKm({ lat: 41.6083, lng: 2.2875 }, { lat: 41.6083001, lng: 2.2875001 })

    expect(Number.isFinite(km)).toBe(true)
    expect(km).toBeLessThan(0.001)
  })
})
