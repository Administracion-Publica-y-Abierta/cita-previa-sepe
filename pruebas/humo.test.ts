import { describe, expect, it } from 'vitest'
import { grabacion } from './ayudantes/grabaciones'
import { montarApp } from './ayudantes/montar-app'

const MAPA = 'https://citaprevia-sede.sepe.gob.es/citapreviasepe/cita/cargaTiposAtencionMapa'
const SUBTRAMITES = 'https://citaprevia-sede.sepe.gob.es/citapreviasepe/cita/cargarComboGruposTramitesByNivel'

function peticion(cuerpo: Record<string, string>): RequestInit {
  return { method: 'POST', body: new URLSearchParams(cuerpo) }
}

describe('el fetch falso contesta con tráfico real del SEPE', () => {
  it('devuelve las 46 oficinas grabadas, 37 de ellas con hueco', async () => {
    const { app, fetch } = montarApp()

    const respuesta = await app.dependencias.fetch(
      MAPA,
      peticion({ codigoPostal: '08402', idGrupoServicio: '631', latOrigen: '41.607931', lngOrigen: '2.286177' }),
    )
    const datos = (await respuesta.json()) as { listaOficina: { primerHuecoDisponible: string }[] }

    expect(respuesta.status).toBe(200)
    expect(datos.listaOficina).toHaveLength(46)
    expect(datos.listaOficina.filter((o) => o.primerHuecoDisponible)).toHaveLength(37)
    expect(fetch.llamadas).toHaveLength(1)
  })

  it('devuelve el HTML del nivel 3, que es el que hay que parsear', async () => {
    const { app } = montarApp()

    const respuesta = await app.dependencias.fetch(
      SUBTRAMITES,
      peticion({ codigoPostal: '08401', idsNiveles: '155', nivel: '2' }),
    )
    const html = await respuesta.text()

    expect(respuesta.headers.get('content-type')).toContain('text/html')
    expect(html).toContain('<option')
    expect(html).toContain('comboTiposServicios')
  })

  it('elige la grabación por los parámetros de la petición, no por el orden', async () => {
    const { app, fetch } = montarApp()

    await app.dependencias.fetch(MAPA, peticion({ codigoPostal: '08401', idGrupoServicio: '23' }))

    // El mismo endpoint con otro trámite: el SEPE contestó con la lista vacía,
    // que es un caso real y distinto de "no hay huecos".
    expect(fetch.llamadas.at(-1)?.grabacion).toBe('cargaTiposAtencionMapa--codigoPostal-08401--idGrupoServicio-23')
  })

  it('falla ruidosamente si se pide algo que no está grabado', async () => {
    const { app } = montarApp()

    await expect(
      app.dependencias.fetch(MAPA, peticion({ codigoPostal: '28001', idGrupoServicio: '23' })),
    ).rejects.toThrow(/no tiene respuesta para cargaTiposAtencionMapa/)
  })

  it('deja poner respuestas a mano para los caminos que no hay grabados', async () => {
    const { app } = montarApp({
      respuestas: [{ endpoint: 'cargaTiposAtencionMapa', estado: 500, cuerpo: '<html>Error</html>', veces: 1 }],
    })

    const averiada = await app.dependencias.fetch(MAPA, peticion({ codigoPostal: '08402', idGrupoServicio: '631' }))
    expect(averiada.status).toBe(500)

    // Agotados los usos del apaño, vuelve a mandar la grabación: así se prueban
    // los reintentos sin inventarse la respuesta buena.
    const buena = await app.dependencias.fetch(MAPA, peticion({ codigoPostal: '08402', idGrupoServicio: '631' }))
    expect(buena.status).toBe(200)
  })

  it('sirve exactamente el cuerpo grabado, sin retocarlo', async () => {
    const { app } = montarApp()

    const respuesta = await app.dependencias.fetch(MAPA, peticion({ codigoPostal: '08402', idGrupoServicio: '631' }))

    expect(await respuesta.text()).toBe(
      grabacion('cargaTiposAtencionMapa--codigoPostal-08402--idGrupoServicio-631').respuesta.cuerpo,
    )
  })
})

describe('el reloj falso', () => {
  it('avanza cuando el test lo dice y no gasta tiempo real', async () => {
    const { app, reloj } = montarApp()
    const { reloj: relojDeLaApp } = app.dependencias

    const inicio = relojDeLaApp.ahora()
    const comienzoReal = Date.now()

    let terminado = false
    const espera = relojDeLaApp.esperar(2500).then(() => {
      terminado = true
    })

    await reloj.avanzar(2499)
    expect(terminado).toBe(false)

    await reloj.avanzar(1)
    await espera

    expect(terminado).toBe(true)
    expect(relojDeLaApp.ahora() - inicio).toBe(2500)
    // Los 2,5 s del freno son innegociables en producción; aquí se respetan sin
    // pagarlos.
    expect(Date.now() - comienzoReal).toBeLessThan(1000)
  })

  it('despierta también a las esperas que nacen mientras el reloj avanza', async () => {
    const { app, reloj } = montarApp()
    const { reloj: relojDeLaApp } = app.dependencias

    // Esto es la forma exacta del freno: esperar antes de cada petición, en
    // serie. La segunda espera no existe hasta que la primera termina, así que
    // un reloj que solo mirase las esperas registradas al empezar dejaría a la
    // segunda dormida para siempre y el test pasaría contando una sola.
    const instantes: number[] = []
    const pasada = (async () => {
      for (let i = 0; i < 3; i += 1) {
        await relojDeLaApp.esperar(2500)
        instantes.push(relojDeLaApp.ahora())
      }
    })()

    await reloj.avanzar(7500)
    await pasada

    expect(instantes).toHaveLength(3)
    expect(instantes[1] - instantes[0]).toBe(2500)
    expect(instantes[2] - instantes[1]).toBe(2500)
  })

  it('arranca en el instante de las capturas, para que sus fechas sigan siendo futuro', () => {
    const { app } = montarApp()

    const hoy = new Date(app.dependencias.reloj.ahora())
    expect(hoy.toISOString().slice(0, 10)).toBe('2026-08-14')
  })
})
