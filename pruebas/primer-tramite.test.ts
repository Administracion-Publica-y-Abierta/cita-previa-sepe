import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/oficinas/route'
import { dejarCorrer } from './ayudantes/dejar-correr'
import { geocodificadorConoce } from './ayudantes/geocodificador-falso'
import { montarApp, type AppDePrueba, type OpcionesDeMontaje } from './ayudantes/montar-app'
import {
  nivelesDelSepe,
  portadaDelSepe,
  sepeCuerpoVacio,
  sepeSaturado,
  subtramitesDelSepe,
} from './ayudantes/sepe-falso'

/**
 * Lo que pide el hero: un código postal y nada más. Quien llega no ha elegido
 * trámite todavía —ni sabe que hay que elegir uno—, así que la primera lista
 * que ve es la del primer trámite que el SEPE ofrezca en su zona.
 */

/** Los dos códigos postales de las capturas caen en Granollers. */
const GRANOLLERS = { municipio: 'Granollers', lat: 41.6083, lng: 2.2875 }

/** El trámite grabado con agenda: 46 oficinas, 37 con hueco. */
const CON_HUECO = 631

/** El trámite grabado sin un solo hueco: 46 oficinas, ninguna con hora. */
const SIN_HUECO = 23

const URL_DE_LA_RUTA = 'http://localhost/api/oficinas'

/**
 * Un árbol de trámites puesto a mano cuyo primer subtrámite es el que se le
 * pide al mapa. Las capturas no traen el nivel 3 de los ocho trámites de
 * 08401, así que el árbol grabado no sirve para decir cuál es «el primero»:
 * se le pone uno al SEPE y se comprueba que sale el que se le ha puesto.
 */
function arbolCuyoPrimerTramiteEs(idSubtramite: number, nombre = 'El primero de la lista') {
  return [
    nivelesDelSepe(1, '', [{ id: 900, nombre: 'PRESTACIONES' }]),
    nivelesDelSepe(2, '900', [{ id: 901, nombre: 'Un trámite' }]),
    subtramitesDelSepe(901, [{ id: idSubtramite, nombre }]),
  ]
}

function montar(opciones: OpcionesDeMontaje = {}): AppDePrueba {
  return montarApp({
    ...opciones,
    respuestas: [
      ...(opciones.respuestas ?? []),
      portadaDelSepe(),
      geocodificadorConoce('08401', GRANOLLERS),
      geocodificadorConoce('08402', GRANOLLERS),
    ],
  })
}

/** Se entra por la ruta de verdad, que es el patrón de este repositorio. */
async function pedirOficinas(codigoPostal: string, opciones: OpcionesDeMontaje = {}) {
  const montaje = montar(opciones)
  const peticion = new Request(URL_DE_LA_RUTA, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cp: codigoPostal }),
  })
  const respuesta = await dejarCorrer(montaje.reloj, POST(peticion))
  return { ...montaje, respuesta, cuerpo: await respuesta.json() }
}

describe('las oficinas del primer trámite', () => {
  it('devuelve la lista con todo lo que el hero tiene que pintar de cada oficina', async () => {
    const { respuesta, cuerpo } = await pedirOficinas('08402', {
      respuestas: arbolCuyoPrimerTramiteEs(CON_HUECO),
    })

    expect(respuesta.status).toBe(200)
    expect(cuerpo.estado).toBe('ok')
    expect(cuerpo.oficinas).toHaveLength(46)
    expect(cuerpo.oficinas.find((o: { id: number }) => o.id === 5079)).toMatchObject({
      nombre: 'GRANOLLERS-PERIFERIA - SEPE',
      direccion: 'AVDA. MARIE CURIE, 25-27',
      telefono: '0901010210',
      horarioAtencion: '08:30 a 14:00',
      primerHueco: '2026-08-17T09:00:00',
    })
    expect(typeof cuerpo.oficinas[0].km).toBe('number')
  })

  it('dice qué trámite ha consultado, con el nombre que le da el SEPE', async () => {
    const { cuerpo } = await pedirOficinas('08402', {
      respuestas: arbolCuyoPrimerTramiteEs(CON_HUECO, 'Voy a salir al extranjero'),
    })

    // Sin esto la lista no se puede leer: son las oficinas *de algo*, y quien
    // pregunta no ha elegido ese algo.
    expect(cuerpo.tramite).toEqual({ id: CON_HUECO, nombre: 'Voy a salir al extranjero' })
  })

  it('distingue las oficinas con hueco de las que no lo tienen', async () => {
    const { cuerpo } = await pedirOficinas('08402', {
      respuestas: arbolCuyoPrimerTramiteEs(CON_HUECO),
    })

    expect(cuerpo.oficinas.filter((o: { primerHueco: string | null }) => o.primerHueco)).toHaveLength(37)
    expect(cuerpo.oficinas.filter((o: { primerHueco: string | null }) => !o.primerHueco)).toHaveLength(9)
  })

  it('un trámite sin ningún hueco es `ok` con la lista entera, no un error', async () => {
    const { cuerpo } = await pedirOficinas('08401', {
      respuestas: arbolCuyoPrimerTramiteEs(SIN_HUECO),
    })

    expect(cuerpo.estado).toBe('ok')
    expect(cuerpo.oficinas).toHaveLength(46)
    expect(cuerpo.oficinas.every((o: { primerHueco: string | null }) => o.primerHueco === null)).toBe(true)
  })

  it('el primero es el primero del árbol, y lo decide el SEPE y no una lista nuestra', async () => {
    const { cuerpo } = await pedirOficinas('08401', {
      respuestas: [
        nivelesDelSepe(1, '', [{ id: 900, nombre: 'PRESTACIONES' }]),
        nivelesDelSepe(2, '900', [
          { id: 901, nombre: 'El trámite que el SEPE lista primero' },
          { id: 902, nombre: 'El segundo' },
        ]),
        subtramitesDelSepe(901, [{ id: SIN_HUECO, nombre: 'El subtrámite que se consulta' }]),
        subtramitesDelSepe(902, [{ id: 4242, nombre: 'Este no se llega a pedir' }]),
      ],
    })

    expect(cuerpo.tramite.id).toBe(SIN_HUECO)
  })

  it('se salta los trámites cuyo combo viene vacío hasta encontrar uno consultable', async () => {
    // Es un caso real: hay trámites de nivel 2 cuyo combo de subtrámites vuelve
    // sin nada dentro, y de esos no hay nada que preguntarle al mapa. Pararse
    // en el primero dejaría el hero en blanco teniendo trámites detrás.
    const { cuerpo } = await pedirOficinas('08401', {
      respuestas: [
        nivelesDelSepe(1, '', [{ id: 900, nombre: 'PRESTACIONES' }]),
        nivelesDelSepe(2, '900', [
          { id: 901, nombre: 'Sin subtrámites' },
          { id: 902, nombre: 'Este sí tiene' },
        ]),
        subtramitesDelSepe(901, []),
        subtramitesDelSepe(902, [{ id: SIN_HUECO, nombre: 'El primero consultable' }]),
      ],
    })

    expect(cuerpo.estado).toBe('ok')
    expect(cuerpo.tramite.id).toBe(SIN_HUECO)
  })

  it('un árbol entero sin subtrámites es `sin-tramites`, y no una avería', async () => {
    const { respuesta, cuerpo } = await pedirOficinas('08401', {
      respuestas: [
        nivelesDelSepe(1, '', [{ id: 900, nombre: 'PRESTACIONES' }]),
        nivelesDelSepe(2, '900', [{ id: 901, nombre: 'Sin subtrámites' }]),
        subtramitesDelSepe(901, []),
      ],
    })

    // No se le pide nada al mapa: no hay identificador que pedirle.
    expect(respuesta.status).toBe(200)
    expect(cuerpo.estado).toBe('sin-tramites')
    expect(cuerpo.oficinas).toEqual([])
    expect(cuerpo.tramite).toBe(null)
  })

  it('dice de dónde salen los kilómetros y con cuánta confianza', async () => {
    const { cuerpo } = await pedirOficinas('08402', {
      respuestas: arbolCuyoPrimerTramiteEs(CON_HUECO),
    })

    expect(cuerpo.localizacion).toMatchObject({ municipio: 'Granollers', precision: 'exacta' })
  })

  it('deja constancia del instante en que se consultó al SEPE', async () => {
    const { cuerpo, reloj } = await pedirOficinas('08402', {
      respuestas: arbolCuyoPrimerTramiteEs(CON_HUECO),
    })

    expect(cuerpo.consultadoEn).toBeGreaterThan(0)
    expect(cuerpo.consultadoEn).toBeLessThanOrEqual(reloj.ahora())
  })
})

describe('las oficinas del primer trámite cuando algo va mal', () => {
  it('un código postal que no es español se rechaza sin salir al SEPE', async () => {
    const { respuesta, cuerpo, fetch } = await pedirOficinas('99999')

    expect(respuesta.status).toBe(400)
    expect(cuerpo.error).toBe('codigo-postal-invalido')
    expect(fetch.llamadas).toEqual([])
  })

  it('si el catálogo no se puede descubrir, no se inventa un trámite', async () => {
    const { cuerpo, fetch } = await pedirOficinas('08401', {
      respuestas: [sepeCuerpoVacio('cargaComboNivelesTramitesCPEntidad')],
    })

    expect(cuerpo.estado).toBe('sin-agenda')
    expect(cuerpo.tramite).toBe(null)
    expect(cuerpo.oficinas).toEqual([])
    expect(fetch.llamadas.filter((l) => l.endpoint === 'cargaTiposAtencionMapa')).toEqual([])
  })

  it('el SEPE caído mientras se descubre el catálogo sale como avería', async () => {
    const { cuerpo } = await pedirOficinas('08401', {
      respuestas: [sepeSaturado('cargaComboNivelesTramitesCPEntidad', 3)],
    })

    expect(cuerpo.estado).toBe('sepe-no-responde')
  })

  it('el catálogo sale bien y el mapa se cae: la avería es la del mapa', async () => {
    const { cuerpo } = await pedirOficinas('08401', {
      respuestas: [...arbolCuyoPrimerTramiteEs(SIN_HUECO), sepeSaturado('cargaTiposAtencionMapa', 3)],
    })

    expect(cuerpo.estado).toBe('sepe-no-responde')
    // El trámite se sabe: se descubrió antes de que el mapa fallara, y decir
    // cuál se estaba consultando es lo que permite volver a intentarlo.
    expect(cuerpo.tramite.id).toBe(SIN_HUECO)
    expect(cuerpo.oficinas).toEqual([])
  })
})
