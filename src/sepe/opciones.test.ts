import { describe, expect, it } from 'vitest'
import { opcionesDe } from './opciones'

/**
 * Test de unidad, y no por la ruta como manda el patrón: el HTML de verdad —el
 * del trámite 155 de la captura— se parsea de extremo a extremo en
 * `pruebas/catalogo.test.ts`. Esto cubre las formas que el SEPE manda en otros
 * códigos postales y que no hay grabadas: acentos escapados, combos vacíos y
 * espacios repartidos a su gusto.
 */
describe('los `<option>` del nivel 3', () => {
  it('saca el identificador y el nombre de cada opción', () => {
    const html = `
      <select id="comboTiposServicios">
        <option value="20"
          data-ids-jerarquia-tramites="5"
          data-esservicio="true">Me voy a jubilar</option>
        <option value="2584"
          data-esservicio="true">Quiero suspender el Complemento</option>
      </select>`

    expect(opcionesDe(html)).toEqual([
      { id: 20, nombre: 'Me voy a jubilar' },
      { id: 2584, nombre: 'Quiero suspender el Complemento' },
    ])
  })

  it('se salta el «--- Seleccionar ---», que no es un trámite', () => {
    // No lleva valor, y ese es justo el rasgo por el que se le distingue: un
    // trámite sin identificador no se puede consultar.
    const html = '<option value="">--- Seleccionar ---</option><option value="14">He encontrado trabajo</option>'

    expect(opcionesDe(html)).toEqual([{ id: 14, nombre: 'He encontrado trabajo' }])
  })

  it('devuelve los nombres tal como se leen, con los acentos deshechos', () => {
    // El SEPE escapa los acentos a su gusto: en la misma respuesta hay
    // `Subtr&aacute;mite` en la etiqueta y texto sin escapar en las opciones.
    // Quien pregunta tiene que leer «Declaración», no «Declaraci&oacute;n».
    const html = '<option value="51">Declaraci&oacute;n anual de Rentas &amp; pr&oacute;rroga</option>'

    expect(opcionesDe(html)).toEqual([{ id: 51, nombre: 'Declaración anual de Rentas & prórroga' }])
  })

  it('junta los espacios y los saltos de línea que el SEPE reparte por dentro', () => {
    const html = '<option value="61">Cobros   indebidos,\n\t sanciones &nbsp;y otras incidencias </option>'

    expect(opcionesDe(html)).toEqual([{ id: 61, nombre: 'Cobros indebidos, sanciones y otras incidencias' }])
  })

  it('un combo sin opciones es una lista vacía, no un error', () => {
    // Pasa de verdad: hay trámites cuyo combo de subtrámites vuelve vacío.
    expect(opcionesDe('<select id="comboTiposServicios"></select>')).toEqual([])
  })

  it('no se queda con una opción sin nombre', () => {
    // Un identificador sin nombre no se le puede enseñar a nadie: quien
    // pregunta elige por el nombre, no por el número.
    expect(opcionesDe('<option value="7"></option><option value="8">Me voy a jubilar</option>')).toEqual([
      { id: 8, nombre: 'Me voy a jubilar' },
    ])
  })
})
