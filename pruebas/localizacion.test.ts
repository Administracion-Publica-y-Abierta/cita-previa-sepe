import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/localizacion/route'
import {
  geocodificadorAveriado,
  geocodificadorConoce,
  geocodificadorNoConoce,
  geocodificadorSinCoordenadas,
} from './ayudantes/geocodificador-falso'
import { montarApp, type OpcionesDeMontaje } from './ayudantes/montar-app'

/** El código postal de las capturas: Granollers, provincia de Barcelona. */
const GRANOLLERS = { municipio: 'Granollers', lat: 41.6083, lng: 2.2875 }

/**
 * Se entra por la ruta de verdad, no por el geocodificador: es lo que dice el
 * patrón de este repositorio y además es lo único que prueba las dos reglas de
 * protección de datos, que viven en la frontera.
 */
async function pedirLocalizacion(codigoPostal: string, opciones: OpcionesDeMontaje = {}) {
  return pedirConCuerpo(JSON.stringify({ cp: codigoPostal }), opciones)
}

/** Para los cuerpos que no tienen la forma buena, que también hay que aguantar. */
async function pedirConCuerpo(cuerpoCrudo: string, opciones: OpcionesDeMontaje = {}, url = URL_DE_LA_RUTA) {
  const montaje = montarApp(opciones)
  const respuesta = await POST(
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: cuerpoCrudo,
    }),
  )
  return { ...montaje, respuesta, cuerpo: await respuesta.clone().json(), texto: await respuesta.text() }
}

const URL_DE_LA_RUTA = 'http://localhost/api/localizacion'

/** Lo que la aplicación escriba mientras corre el bloque, línea a línea. */
async function loQueSeEscribe(bloque: () => Promise<unknown>): Promise<string[]> {
  const escrito: string[] = []
  for (const metodo of ['debug', 'log', 'info', 'warn', 'error'] as const) {
    vi.spyOn(console, metodo).mockImplementation((...partes: unknown[]) => {
      escrito.push(partes.map(String).join(' '))
    })
  }
  await bloque()
  return escrito
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('la localización de un código postal', () => {
  it('devuelve coordenadas y municipio, marcados como exactos', async () => {
    const { respuesta, cuerpo, fetch } = await pedirLocalizacion('08401', {
      respuestas: [geocodificadorConoce('08401', GRANOLLERS)],
    })

    expect(respuesta.status).toBe(200)
    expect(cuerpo).toEqual({
      lat: 41.6083,
      lng: 2.2875,
      municipio: 'Granollers',
      provincia: 'Barcelona',
      precision: 'exacta',
    })
    // Una sola salida a la red, y por el `fetch` inyectado: si el
    // geocodificador se lo fabricase por su cuenta, aquí no habría nada.
    expect(fetch.llamadas).toHaveLength(1)
  })

  it('cae al centroide de la provincia, y lo marca aproximado, si el geocodificador no lo conoce', async () => {
    const { respuesta, cuerpo } = await pedirLocalizacion('28999', {
      respuestas: [geocodificadorNoConoce('28999')],
    })

    expect(respuesta.status).toBe(200)
    expect(cuerpo).toEqual({
      lat: 40.4168,
      lng: -3.7038,
      municipio: null,
      provincia: 'Madrid',
      precision: 'aproximada-provincial',
    })
  })

  it('cae también al centroide si el geocodificador está caído', async () => {
    const { respuesta, cuerpo } = await pedirLocalizacion('15001', {
      respuestas: [geocodificadorAveriado('15001')],
    })

    expect(respuesta.status).toBe(200)
    expect(cuerpo.precision).toBe('aproximada-provincial')
    expect(cuerpo.provincia).toBe('A Coruña')
  })

  it('cae al centroide si el geocodificador contesta algo que no se entiende', async () => {
    const { respuesta, cuerpo } = await pedirLocalizacion('46001', {
      respuestas: [geocodificadorSinCoordenadas('46001')],
    })

    expect(respuesta.status).toBe(200)
    expect(cuerpo.precision).toBe('aproximada-provincial')
    expect(cuerpo.provincia).toBe('Valencia')
  })

  it('cae al centroide si ni siquiera se puede salir a la red', async () => {
    // Sin respuesta a mano, el `fetch` falso lanza: es la forma que tiene aquí
    // un error de red, y el resultado debe ser el mismo que con un 503.
    const { respuesta, cuerpo } = await pedirLocalizacion('41001')

    expect(respuesta.status).toBe(200)
    expect(cuerpo.precision).toBe('aproximada-provincial')
    expect(cuerpo.provincia).toBe('Sevilla')
  })

  it('marca exacta la localización aunque el geocodificador no dé nombre de municipio', async () => {
    const { cuerpo } = await pedirLocalizacion('08401', {
      respuestas: [geocodificadorConoce('08401', { ...GRANOLLERS, municipio: '' })],
    })

    // El nombre es un adorno; lo que decide si la distancia es de fiar son las
    // coordenadas, y esas han venido del código postal, no de la provincia.
    expect(cuerpo.precision).toBe('exacta')
    expect(cuerpo.municipio).toBeNull()
    expect(cuerpo.lat).toBe(41.6083)
  })
})

describe('el código postal que llega mal', () => {
  it('se rechaza si no son cinco dígitos', async () => {
    const { respuesta, fetch } = await pedirLocalizacion('841')

    expect(respuesta.status).toBe(400)
    // No se sale a la red por algo que ya se sabe que no vale.
    expect(fetch.llamadas).toHaveLength(0)
  })

  it('se rechaza si falta, si viene vacío o si no es ni una cadena', async () => {
    expect((await pedirLocalizacion('')).respuesta.status).toBe(400)
    expect((await pedirConCuerpo('{}')).respuesta.status).toBe(400)
    // Un número con cinco dígitos es la forma fácil de colarse por un `typeof`
    // que no se mira.
    expect((await pedirConCuerpo('{"cp":8401}')).respuesta.status).toBe(400)
  })

  it('se rechaza sin reventar si el cuerpo no es ni JSON', async () => {
    expect((await pedirConCuerpo('esto no es json')).respuesta.status).toBe(400)
    expect((await pedirConCuerpo('')).respuesta.status).toBe(400)
  })

  it('se rechaza si los dos primeros dígitos no son una provincia española', async () => {
    // 99 no existe. Antes esto acababa en el centroide de Madrid, que es peor
    // que un error: sitúa a alguien a 600 km sin decírselo.
    const { respuesta, cuerpo } = await pedirLocalizacion('99999')

    expect(respuesta.status).toBe(400)
    expect(cuerpo.error).toBe('codigo-postal-invalido')
  })
})

describe('las dos reglas de protección de datos', () => {
  // La tercera —que el código postal no viaje nunca en la URL— se comprueba
  // además sobre el propio código en `proteccion-de-datos.test.ts`: lo que hay
  // que impedir es la ruta que nadie ha escrito todavía.

  it('no lee el código postal de la URL aunque se lo pongan ahí', async () => {
    // Si algún día alguien vuelve a leer la cadena de consulta, esto lo caza:
    // el alojamiento registra la URL entera y ahí quedaría escrito.
    const { respuesta, fetch } = await pedirConCuerpo('{}', {}, `${URL_DE_LA_RUTA}?cp=08401`)

    expect(respuesta.status).toBe(400)
    expect(fetch.llamadas).toHaveLength(0)
  })

  it('no escribe el código postal en ningún registro, falle como falle el geocodificador', async () => {
    const casos = [
      geocodificadorAveriado('08401'),
      geocodificadorNoConoce('08401'),
      geocodificadorSinCoordenadas('08401'),
    ]

    for (const caso of casos) {
      const escrito = await loQueSeEscribe(() => pedirLocalizacion('08401', { respuestas: [caso] }))

      // Que haya escrito algo forma parte de la prueba: si un día se deja de
      // avisar, este test pasaría solo y sin decir nada.
      expect(escrito.length).toBeGreaterThan(0)
      expect(escrito.join('\n')).not.toContain('08401')
      vi.restoreAllMocks()
    }
  })

  it('tampoco lo escribe cuando no se puede salir a la red', async () => {
    const escrito = await loQueSeEscribe(() => pedirLocalizacion('08401'))

    expect(escrito.length).toBeGreaterThan(0)
    expect(escrito.join('\n')).not.toContain('08401')
  })

  it('no escribe nada cuando todo va bien', async () => {
    const escrito = await loQueSeEscribe(() =>
      pedirLocalizacion('08401', { respuestas: [geocodificadorConoce('08401', GRANOLLERS)] }),
    )

    expect(escrito).toEqual([])
  })

  it('devuelve mensajes de error sin nada de lo que haya tecleado quien pregunta', async () => {
    const { respuesta, texto } = await pedirLocalizacion('<script>alert(1)</script>')

    expect(respuesta.status).toBe(400)
    expect(texto).not.toContain('script')
    expect(texto).not.toContain('alert')
    // Y el texto que se le enseña a la persona está en castellano y explica qué
    // se espera, sin códigos de error crudos.
    expect(JSON.parse(texto).mensaje).toContain('cinco dígitos')
  })

  it('tampoco devuelve el código postal en el mensaje de error', async () => {
    const { texto } = await pedirLocalizacion('99999')

    expect(texto).not.toContain('99999')
  })
})
