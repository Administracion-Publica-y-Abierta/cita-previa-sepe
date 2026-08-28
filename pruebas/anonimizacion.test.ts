import { describe, expect, it } from 'vitest'
import { anonimizar, contarDatosPersonales } from '../scripts/datos-personales.mjs'

/**
 * Los fixtures de hoy salen de endpoints de lectura, que no llevan datos
 * personales: la anonimización no llega a actuar sobre ellos y comprobar que
 * están limpios no demuestra que sepa limpiar.
 *
 * Estos tests le dan el trabajo que sí tendrá el día que se graben los
 * endpoints de reserva, que es donde el DNI viaja en la URL. Los valores de
 * aquí son inventados con la forma correcta, no de nadie.
 */
describe('la anonimización', () => {
  it('borra el DNI de una URL de reserva sin tocar el resto', () => {
    const url = '/citapreviasepe/cita/calendarioServicio?idOficina=5109&documento=12345678Z&codIdioma=es'

    expect(anonimizar(url)).toBe(
      '/citapreviasepe/cita/calendarioServicio?idOficina=5109&documento=00000000T&codIdioma=es',
    )
  })

  it('borra también el NIE, el móvil y el correo', () => {
    const formulario = 'nif=X1234567L&telefono=612345678&email=alguien@ejemplo.com'

    expect(anonimizar(formulario)).toBe(
      'nif=00000000T&telefono=600000000&email=persona@ejemplo.invalid',
    )
  })

  it('no se lleva por delante el teléfono público de las oficinas', () => {
    // 0901010210 es el número de atención del SEPE: sale en las 46 oficinas y
    // la ficha lo enseña. Si el patrón de móvil se lo tragase, los fixtures
    // seguirían pasando los tests pero la interfaz enseñaría un teléfono falso.
    expect(anonimizar('"telefono":"0901010210"')).toBe('"telefono":"0901010210"')
  })

  it('deja lo ya anonimizado como está, para poder pasarlo dos veces', () => {
    expect(anonimizar(anonimizar('documento=12345678Z'))).toBe('documento=00000000T')
  })

  it('cuenta lo que se le ha escapado sin repetir el valor', () => {
    const cuentas = contarDatosPersonales('documento=12345678Z&otro=87654321X')

    expect(cuentas).toEqual([{ nombre: 'DNI', cantidad: 2 }])
    // El aviso acaba en la consola y en el registro de CI: si llevara el valor,
    // el guardián sería la fuga.
    expect(JSON.stringify(cuentas)).not.toContain('12345678Z')
  })
})
