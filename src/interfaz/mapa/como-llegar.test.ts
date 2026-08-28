import { describe, expect, it } from 'vitest'
import { comoLlegar } from './como-llegar'

/**
 * El enlace que saca a quien mira de esta web y lo mete en su aplicación de
 * mapas. Es el último paso de todo el recorrido —ya ha elegido oficina y lo
 * que quiere es llegar— y por eso no puede fallar en silencio.
 */

const OFICINA = { nombre: 'GRANOLLERS-PERIFERIA - SEPE', lat: 41.594542, lng: 2.289705 }

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

describe('cómo llegar a una oficina', () => {
  it('en un iPhone abre Mapas de Apple, que es lo que hay instalado', () => {
    const enlace = new URL(comoLlegar(OFICINA, IPHONE))

    expect(enlace.host).toBe('maps.apple.com')
    expect(enlace.searchParams.get('ll')).toBe('41.594542,2.289705')
    expect(enlace.searchParams.get('q')).toBe('GRANOLLERS-PERIFERIA - SEPE')
  })

  it('en cualquier otro sitio abre Google Maps', () => {
    const enlace = new URL(comoLlegar(OFICINA, ANDROID))

    expect(enlace.host).toBe('www.google.com')
    expect(enlace.searchParams.get('query')).toBe('41.594542,2.289705')
  })

  it('lleva coordenadas y no la dirección escrita', () => {
    // La dirección que manda el SEPE no lleva ni municipio ni provincia
    // —«AVDA. MARIE CURIE, 25-27»—, y buscarla tal cual manda a quien llega a
    // la calle con ese nombre de otra ciudad. Las coordenadas son exactas.
    expect(comoLlegar(OFICINA, ANDROID)).not.toContain('MARIE')
    expect(comoLlegar(OFICINA, IPHONE)).toContain('41.594542')
  })

  it('escapa el nombre de la oficina en vez de pegarlo en la URL', () => {
    const enlace = comoLlegar({ ...OFICINA, nombre: 'BARCELONA & SANTS' }, IPHONE)

    expect(enlace).not.toContain(' ')
    expect(new URL(enlace).searchParams.get('q')).toBe('BARCELONA & SANTS')
  })
})
