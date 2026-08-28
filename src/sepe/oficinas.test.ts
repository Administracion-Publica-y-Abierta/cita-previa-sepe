import { describe, expect, it } from 'vitest'
import { primerHuecoDe } from './oficinas'

/**
 * Test de unidad, y no por la ruta como manda el patrón: los formatos raros de
 * abajo no existen en las capturas y no hay forma de provocarlos desde
 * `montarApp()` sin inventarse una respuesta del SEPE por cada uno. El caso
 * real —el formato bueno y la cadena vacía— sí se prueba de extremo a extremo
 * en `pruebas/busqueda.test.ts`; esto solo cubre qué pasa si el SEPE cambia.
 */
describe('el primer hueco que manda el SEPE', () => {
  it('se lee en su formato real', () => {
    expect(primerHuecoDe('2026-08-17, 09:00:00')).toBe('2026-08-17T09:00:00')
  })

  it('sin hueco es la cadena vacía, y eso es `null`', () => {
    expect(primerHuecoDe('')).toBeNull()
    expect(primerHuecoDe('   ')).toBeNull()
  })

  it('no se inventa una fecha con lo que no lo es', () => {
    // Si el SEPE cambiara el formato, es preferible que la oficina salga sin
    // hueco a que salga con una hora falsa: una hora falsa manda a alguien a
    // una oficina para nada.
    expect(primerHuecoDe('proximamente')).toBeNull()
    expect(primerHuecoDe('17/08/2026 09:00')).toBeNull()
    expect(primerHuecoDe('2026-08-17')).toBeNull()
  })
})
