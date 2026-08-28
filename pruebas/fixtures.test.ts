import { describe, expect, it } from 'vitest'
import { contarDatosPersonales } from '../scripts/datos-personales.mjs'
import { cargarGrabaciones, grabacion } from './ayudantes/grabaciones'

const grabaciones = cargarGrabaciones()

interface OficinaGrabada {
  oficina: string
  telefono: string
  primerHuecoDisponible: string
}

function oficinas(clave: string): OficinaGrabada[] {
  return (JSON.parse(grabacion(clave).respuesta.cuerpo) as { listaOficina: OficinaGrabada[] }).listaOficina
}

describe('los fixtures cubren lo que ya está medido', () => {
  it('tiene el caso de 46 oficinas sin ningún hueco', () => {
    const lista = oficinas('cargaOficinasMapa--codigoPostal-08401--idGrupoServicio-23')

    expect(lista).toHaveLength(46)
    expect(lista.filter((o) => o.primerHuecoDisponible)).toHaveLength(0)
  })

  it('tiene el caso de las mismas 46 oficinas con 37 con hueco', () => {
    const lista = oficinas('cargaTiposAtencionMapa--codigoPostal-08402--idGrupoServicio-631')

    expect(lista).toHaveLength(46)
    expect(lista.filter((o) => o.primerHuecoDisponible)).toHaveLength(37)
  })

  it('tiene una respuesta vacía del SEPE, que no significa "sin agenda"', () => {
    expect(oficinas('cargaTiposAtencionMapa--codigoPostal-08401--idGrupoServicio-23')).toHaveLength(0)
  })

  it('tiene los tres niveles del catálogo, incluido el HTML del nivel 3', () => {
    const porEndpoint = (endpoint: string) => grabaciones.filter((g) => g.endpoint === endpoint)

    const niveles = porEndpoint('cargaComboNivelesTramitesCPEntidad')
    expect(niveles.map((g) => g.discriminadores.nivel).sort()).toEqual(['1', '2'])

    const [nivelTres] = porEndpoint('cargarComboGruposTramitesByNivel')
    expect(nivelTres.respuesta.tipoContenido).toContain('text/html')
    expect(nivelTres.respuesta.cuerpo).toContain('<option')
  })
})

describe('los fixtures no llevan datos personales', () => {
  // Las capturas originales sí los llevan: el DNI va en la URL de la parte de
  // reserva. Este test es el que garantiza que la anonimización del extractor
  // sigue haciendo su trabajo cuando alguien vuelva a extraer con capturas
  // nuevas.
  const todo = JSON.stringify(grabaciones)

  it('no contiene ningún DNI, NIE, móvil ni correo de una persona', () => {
    expect(contarDatosPersonales(todo)).toEqual([])
  })

  it('no arrastra cabeceras de la captura, y con ellas el JSESSIONID', () => {
    expect(todo).not.toContain('JSESSIONID')
  })

  it('conserva el teléfono público de las oficinas, que sí hace falta', () => {
    // El patrón de móvil no puede tragarse el teléfono de atención del SEPE:
    // es público, es el mismo para todas las oficinas y la ficha lo enseña.
    // (Una de las 46 lo trae vacío en la captura; eso viene así del SEPE.)
    const telefonos = new Set(
      oficinas('cargaTiposAtencionMapa--codigoPostal-08402--idGrupoServicio-631')
        .map((o) => o.telefono)
        .filter(Boolean),
    )

    expect([...telefonos]).toEqual(['0901010210'])
  })
})
