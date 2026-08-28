import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/tramites/route'
import { JITTER_MAXIMO_MS, PAUSA_MINIMA_MS } from '@/sepe/freno'
import { dejarCorrer } from './ayudantes/dejar-correr'
import type { FetchFalso } from './ayudantes/fetch-falso'
import { geocodificadorConoce } from './ayudantes/geocodificador-falso'
import { montarApp, type AppDePrueba, type OpcionesDeMontaje } from './ayudantes/montar-app'
import {
  nivelesDelSepe,
  portadaDelSepe,
  sepeCuerpoVacio,
  sepeSaturado,
  subtramitesDelSepe,
} from './ayudantes/sepe-falso'

/** El código postal de las capturas. Es el único con árbol de trámites grabado. */
const GRANOLLERS = { municipio: 'Granollers', lat: 41.6083, lng: 2.2875 }

/** La única rama raíz que el SEPE ofrece en 08401. */
const PRESTACIONES = 146

/**
 * El trámite cuyo nivel 3 sí bajó la captura. Los otros siete de la rama se
 * quedaron sin desplegar, así que su combo se contesta a mano y vacío —que es
 * un caso real del SEPE— para poder pedir el árbol entero sin inventarse
 * nombres que nadie ha visto.
 */
const ESTOY_COBRANDO = 155
const SIN_DESPLEGAR = [158, 264, 164, 152, 149, 241, 161]

const URL_DE_LA_RUTA = 'http://localhost/api/tramites'

function montar(opciones: OpcionesDeMontaje = {}): AppDePrueba {
  return montarApp({
    ...opciones,
    respuestas: [
      ...(opciones.respuestas ?? []),
      portadaDelSepe(),
      geocodificadorConoce('08401', GRANOLLERS),
      ...SIN_DESPLEGAR.map((idTramite) => subtramitesDelSepe(idTramite, [])),
    ],
  })
}

/**
 * Se entra por la ruta de verdad, que es el patrón de este repositorio: por
 * ahí pasan también las dos reglas de protección de datos, que viven en la
 * frontera y no dentro del catálogo.
 */
async function pedirCatalogo(codigoPostal: string, opciones: OpcionesDeMontaje = {}, url = URL_DE_LA_RUTA) {
  const montaje = montar(opciones)
  const peticion = new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cp: codigoPostal }),
  })
  const respuesta = await dejarCorrer(montaje.reloj, POST(peticion))
  return { ...montaje, respuesta, cuerpo: await respuesta.clone().json(), texto: await respuesta.text() }
}

/** Solo las peticiones al SEPE: las del geocodificador no llevan freno. */
function alSepe(fetch: FetchFalso) {
  return fetch.llamadas.filter((l) => l.url.includes('citapreviasepe'))
}

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

describe('el catálogo de trámites de un código postal', () => {
  it('devuelve el árbol de los tres niveles, con los nombres que el SEPE les da', async () => {
    const { respuesta, cuerpo } = await pedirCatalogo('08401')

    expect(respuesta.status).toBe(200)
    expect(cuerpo.estado).toBe('ok')
    expect(cuerpo.ramas).toHaveLength(1)
    expect(cuerpo.ramas[0]).toMatchObject({ id: PRESTACIONES, nombre: 'PRESTACIONES' })

    // Los ocho trámites de la rama, con el nombre tal cual lo escribe el SEPE:
    // es el que quien pregunta va a volver a ver en la sede.
    const tramites = cuerpo.ramas[0].tramites
    expect(tramites).toHaveLength(8)
    expect(tramites.map((t: { id: number }) => t.id)).toEqual([158, 264, 164, 152, 149, 155, 241, 161])
    expect(tramites.find((t: { id: number }) => t.id === ESTOY_COBRANDO).nombre).toBe(
      'Estoy cobrando prestación/subsidio y ha cambiado mi situación',
    )
    expect(tramites.find((t: { id: number }) => t.id === 149).nombre).toBe(
      'Cobros indebidos, sanciones, variaciones económicas o familiares y otras incidencias',
    )
  })

  it('el nivel 3 sale del HTML grabado, con sus `<option>` parseados', async () => {
    const { cuerpo } = await pedirCatalogo('08401')

    const tramite = cuerpo.ramas[0].tramites.find((t: { id: number }) => t.id === ESTOY_COBRANDO)

    // Esto es exactamente lo que hay dentro del `<select>` de la captura, el
    // «--- Seleccionar ---» aparte, que no es un trámite.
    expect(tramite.subtramites).toEqual([
      { id: 20, nombre: 'Estoy de baja por Incapacidad Temporal/ maternidad / paternidad' },
      { id: 14, nombre: 'He encontrado trabajo completo/parcial o me he autoempleado por cuenta propia' },
      { id: 17, nombre: 'Me voy a jubilar' },
      { id: 23, nombre: 'Voy a salir al extranjero' },
      { id: 2584, nombre: 'Quiero suspender el Complemento de Apoyo al Empleo CAE' },
    ])
  })

  it('del nivel 3 sale el identificador con el que la búsqueda pregunta por las oficinas', async () => {
    // El criterio de verdad del catálogo: que lo que descubre le sirva al
    // buscador tal cual, sin que nadie traduzca nada por el camino.
    const montaje = montar()

    const arbol = await dejarCorrer(montaje.reloj, montaje.app.catalogo.de('08401'))
    const tramite = arbol.ramas[0].tramites.find((t) => t.id === ESTOY_COBRANDO)!
    const idTramite = tramite.subtramites.find((s) => s.nombre === 'Voy a salir al extranjero')!.id

    const busqueda = await dejarCorrer(
      montaje.reloj,
      montaje.app.buscador.buscar({ codigoPostal: '08401', idTramite }),
    )

    expect(busqueda.estado).toBe('ok')
    expect(busqueda.oficinas).toHaveLength(46)
  })

  it('un combo de subtrámites vacío deja el trámite sin subtrámites, no rompe el árbol', async () => {
    const { cuerpo } = await pedirCatalogo('08401')

    const otros = cuerpo.ramas[0].tramites.filter((t: { id: number }) => t.id !== ESTOY_COBRANDO)
    expect(otros).toHaveLength(7)
    expect(otros.every((t: { subtramites: unknown[] }) => t.subtramites.length === 0)).toBe(true)
  })

  it('no lleva ningún trámite escrito a mano: si el SEPE cambia el árbol, cambia el catálogo', async () => {
    // Con el árbol grabado, un catálogo con los identificadores cableados
    // pasaría los tests de arriba igual. Aquí se le cambia el árbol al SEPE por
    // uno que no existe en ninguna captura y tiene que salir ese.
    const { cuerpo } = await pedirCatalogo('08401', {
      respuestas: [
        nivelesDelSepe(1, '', [{ id: 900, nombre: 'RAMA QUE NO EXISTÍA' }]),
        nivelesDelSepe(2, '900', [{ id: 901, nombre: 'Un trámite recién inventado' }]),
        subtramitesDelSepe(901, [{ id: 902, nombre: 'Y su subtrámite' }]),
      ],
    })

    expect(cuerpo.ramas).toEqual([
      {
        id: 900,
        nombre: 'RAMA QUE NO EXISTÍA',
        tramites: [
          {
            id: 901,
            nombre: 'Un trámite recién inventado',
            subtramites: [{ id: 902, nombre: 'Y su subtrámite' }],
          },
        ],
      },
    ])
  })

  it('deja constancia del instante en que se consultó al SEPE', async () => {
    const { cuerpo, reloj } = await pedirCatalogo('08401')

    expect(cuerpo.consultadoEn).toBeGreaterThan(0)
    expect(cuerpo.consultadoEn).toBeLessThanOrEqual(reloj.ahora())
  })
})

describe('el catálogo cuando el SEPE no colabora', () => {
  it('una respuesta vacía es `sin-agenda`, no una avería', async () => {
    const { respuesta, cuerpo } = await pedirCatalogo('08401', {
      respuestas: [sepeCuerpoVacio('cargaComboNivelesTramitesCPEntidad')],
    })

    expect(respuesta.status).toBe(200)
    expect(cuerpo.estado).toBe('sin-agenda')
    expect(cuerpo.ramas).toEqual([])
  })

  it('un HTML de error en los niveles se reintenta con sesión nueva, y a la segunda sale bien', async () => {
    const { cuerpo, fetch } = await pedirCatalogo('08401', {
      respuestas: [sepeSaturado('cargaComboNivelesTramitesCPEntidad', 1)],
    })

    expect(cuerpo.estado).toBe('ok')
    expect(cuerpo.ramas).toHaveLength(1)
    // Dos portadas: la del arranque y la de la sesión nueva del reintento.
    expect(fetch.llamadas.filter((l) => l.endpoint === '')).toHaveLength(2)
  })

  it('una página de error donde tenía que ir el combo del nivel 3 no pasa por combo vacío', async () => {
    // Es la trampa propia de este nivel: la respuesta buena también es HTML, así
    // que sin mirar lo que lleva dentro, la página de saturación del SEPE se
    // colaría como «este trámite no tiene subtrámites» y el catálogo saldría
    // mutilado con cara de estar completo.
    const { cuerpo, fetch } = await pedirCatalogo('08401', {
      respuestas: [sepeSaturado('cargarComboGruposTramitesByNivel', 3)],
    })

    expect(cuerpo.estado).toBe('sepe-no-responde')
    expect(cuerpo.ramas).toEqual([])
    expect(fetch.llamadas.filter((l) => l.endpoint === 'cargarComboGruposTramitesByNivel')).toHaveLength(3)
  })

  it('a la tercera se rinde con `sepe-no-responde`', async () => {
    const { respuesta, cuerpo } = await pedirCatalogo('08401', {
      respuestas: [sepeSaturado('cargaComboNivelesTramitesCPEntidad', 3)],
    })

    expect(respuesta.status).toBe(200)
    expect(cuerpo.estado).toBe('sepe-no-responde')
    expect(cuerpo.ramas).toEqual([])
  })
})

describe('el trato con el SEPE mientras se descubre el catálogo', () => {
  it('nunca lanza dos peticiones con menos de 2,5 segundos entre ellas, y la pausa lleva jitter', async () => {
    const { fetch } = await pedirCatalogo('08401')

    const instantes = alSepe(fetch).map((l) => l.instante)
    const pausas = instantes.slice(1).map((instante, i) => instante - instantes[i])

    // Once peticiones: la portada, los dos niveles en JSON y los ocho combos.
    expect(instantes).toHaveLength(11)
    expect(Math.min(...pausas)).toBeGreaterThanOrEqual(PAUSA_MINIMA_MS)
    expect(Math.max(...pausas)).toBeGreaterThan(PAUSA_MINIMA_MS)
    expect(Math.max(...pausas)).toBeLessThanOrEqual(PAUSA_MINIMA_MS + JITTER_MAXIMO_MS)
  })

  it('comparte el freno con la búsqueda: un catálogo y una búsqueda seguidos no se pisan', async () => {
    const montaje = montar()

    await dejarCorrer(montaje.reloj, montaje.app.catalogo.de('08401'))
    await dejarCorrer(montaje.reloj, montaje.app.buscador.buscar({ codigoPostal: '08401', idTramite: 23 }))

    const instantes = alSepe(montaje.fetch).map((l) => l.instante)
    const pausas = instantes.slice(1).map((instante, i) => instante - instantes[i])

    expect(Math.min(...pausas)).toBeGreaterThanOrEqual(PAUSA_MINIMA_MS)
  })
})

describe('el catálogo y la protección de datos', () => {
  it('rechaza el código postal que no vale sin salir a la red', async () => {
    const { respuesta, cuerpo, fetch } = await pedirCatalogo('99999')

    expect(respuesta.status).toBe(400)
    expect(cuerpo.error).toBe('codigo-postal-invalido')
    expect(fetch.llamadas).toHaveLength(0)
  })

  it('no lee el código postal de la URL aunque se lo pongan ahí', async () => {
    const montaje = montar()
    const respuesta = await dejarCorrer(
      montaje.reloj,
      POST(new Request(`${URL_DE_LA_RUTA}?cp=08401`, { method: 'POST', body: '{}' })),
    )

    expect(respuesta.status).toBe(400)
    expect(montaje.fetch.llamadas).toHaveLength(0)
  })

  it('no escribe el código postal en ningún registro cuando el SEPE se atraganta', async () => {
    const escrito = await loQueSeEscribe(() =>
      pedirCatalogo('08401', { respuestas: [sepeSaturado('cargarComboGruposTramitesByNivel', 3)] }),
    )

    // Que haya escrito algo forma parte de la prueba: si un día se deja de
    // avisar, este test pasaría solo y sin decir nada.
    expect(escrito.length).toBeGreaterThan(0)
    expect(escrito.join('\n')).not.toContain('08401')
  })

  it('no devuelve nada de lo que haya tecleado quien pregunta', async () => {
    const { respuesta, texto } = await pedirCatalogo('<script>alert(1)</script>')

    expect(respuesta.status).toBe(400)
    expect(texto).not.toContain('script')
    expect(texto).not.toContain('alert')
  })
})
