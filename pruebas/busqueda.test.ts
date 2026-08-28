import { describe, expect, it } from 'vitest'
import { distanciaEnKm } from '@/localizacion/distancia'
import { JITTER_MAXIMO_MS, PAUSA_MINIMA_MS } from '@/sepe/freno'
import { dejarCorrer } from './ayudantes/dejar-correr'
import { alSepe, type FetchFalso } from './ayudantes/fetch-falso'
import { geocodificadorConoce } from './ayudantes/geocodificador-falso'
import { montarApp, type AppDePrueba, type OpcionesDeMontaje } from './ayudantes/montar-app'
import { portadaDelSepe, sepeCuerpoVacio, sepeSaturado, sepeSinOficinas } from './ayudantes/sepe-falso'

/** El trámite grabado con agenda: 46 oficinas, 37 con hueco. */
const CON_HUECO = { codigoPostal: '08402', idTramite: 631 }

/**
 * El trámite grabado cuyo `cargaTiposAtencionMapa` vino con `listaOficina`
 * vacía. Es el único caso que obliga a la segunda llamada, y además tiene 46
 * oficinas y ni un solo hueco: prueba dos criterios a la vez.
 */
const SIN_HUECO = { codigoPostal: '08401', idTramite: 23 }

/** Los dos códigos postales de las capturas caen en Granollers. */
const GRANOLLERS = { municipio: 'Granollers', lat: 41.6083, lng: 2.2875 }

/** La oficina que sale en las dos capturas, con sus datos verificados. */
const GRANOLLERS_PERIFERIA = 5079

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

async function buscar(consulta: { codigoPostal: string; idTramite: number }, opciones: OpcionesDeMontaje = {}) {
  const montaje = montar(opciones)
  const busqueda = await dejarCorrer(montaje.reloj, montaje.app.buscador.buscar(consulta))
  return { ...montaje, busqueda }
}

function vecesQueSePidio(fetch: FetchFalso, endpoint: string): number {
  return fetch.llamadas.filter((l) => l.endpoint === endpoint).length
}

/** Cada visita a la portada es una sesión nueva con el SEPE. */
function sesionesAbiertas(fetch: FetchFalso): number {
  return vecesQueSePidio(fetch, '')
}

describe('la búsqueda de un trámite', () => {
  it('devuelve las oficinas de la zona con todo lo que hace falta para pintarlas', async () => {
    const { busqueda } = await buscar(CON_HUECO)

    expect(busqueda.estado).toBe('ok')
    expect(busqueda.oficinas).toHaveLength(46)
    expect(busqueda.oficinas.filter((o) => o.primerHueco)).toHaveLength(37)
    expect(busqueda.oficinas.find((o) => o.id === GRANOLLERS_PERIFERIA)).toMatchObject({
      nombre: 'GRANOLLERS-PERIFERIA - SEPE',
      direccion: 'AVDA. MARIE CURIE, 25-27',
      telefono: '0901010210',
      horarioAtencion: '08:30 a 14:00',
      lat: 41.594542,
      lng: 2.289705,
      primerHueco: '2026-08-17T09:00:00',
    })
  })

  it('mide la distancia desde el código postal y no se cree la del SEPE', async () => {
    const { busqueda } = await buscar(CON_HUECO)

    const oficina = busqueda.oficinas.find((o) => o.id === GRANOLLERS_PERIFERIA)!
    expect(oficina.km).toBeCloseTo(distanciaEnKm(GRANOLLERS, { lat: oficina.lat, lng: oficina.lng }), 6)
    // La captura trae `distanciaCP: 1.5174...` para esta misma oficina,
    // calculada contra otras coordenadas. No es la que se devuelve.
    expect(Math.abs(oficina.km - 1.5174148795276086)).toBeGreaterThan(0.01)
  })

  it('resuelve la consulta con una sola llamada, no con dos', async () => {
    const { busqueda, fetch } = await buscar(CON_HUECO)

    expect(busqueda.oficinas).toHaveLength(46)
    expect(vecesQueSePidio(fetch, 'cargaTiposAtencionMapa')).toBe(1)
    expect(vecesQueSePidio(fetch, 'cargaOficinasMapa')).toBe(0)
  })

  it('solo recurre a la segunda llamada si la primera viene sin oficinas', async () => {
    const { busqueda, fetch } = await buscar(SIN_HUECO)

    expect(vecesQueSePidio(fetch, 'cargaTiposAtencionMapa')).toBe(1)
    expect(vecesQueSePidio(fetch, 'cargaOficinasMapa')).toBe(1)
    expect(busqueda.oficinas).toHaveLength(46)
  })

  it('un trámite sin ningún hueco es `ok` con cero oficinas con hueco, no un error', async () => {
    const { busqueda } = await buscar(SIN_HUECO)

    expect(busqueda.estado).toBe('ok')
    expect(busqueda.oficinas).toHaveLength(46)
    expect(busqueda.oficinas.filter((o) => o.primerHueco)).toHaveLength(0)
  })

  it('interpreta el primer hueco en su formato real, cadena vacía incluida', async () => {
    const { busqueda } = await buscar(CON_HUECO)

    const conHueco = busqueda.oficinas.filter((o) => o.primerHueco !== null)
    expect(conHueco.every((o) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(o.primerHueco!))).toBe(true)
    // Las nueve restantes traían la cadena vacía: no tienen hueco para este
    // trámite, que no es lo mismo que no existir.
    expect(busqueda.oficinas.filter((o) => o.primerHueco === null)).toHaveLength(9)
  })

  it('dice de dónde salen las distancias', async () => {
    const { busqueda } = await buscar(CON_HUECO)

    expect(busqueda.localizacion).toMatchObject({ municipio: 'Granollers', precision: 'exacta' })
  })

  it('deja constancia del instante en que se consultó al SEPE', async () => {
    const { busqueda, reloj } = await buscar(CON_HUECO)

    expect(busqueda.consultadoEn).toBeGreaterThan(0)
    expect(busqueda.consultadoEn).toBeLessThanOrEqual(reloj.ahora())
  })
})

describe('cuando el SEPE no colabora', () => {
  it('una respuesta vacía es `sin-agenda`, no una avería', async () => {
    const { busqueda } = await buscar(CON_HUECO, { respuestas: [sepeCuerpoVacio('cargaTiposAtencionMapa')] })

    expect(busqueda.estado).toBe('sin-agenda')
    expect(busqueda.oficinas).toEqual([])
  })

  it('una respuesta en regla pero sin oficinas es `ok` con la lista vacía', async () => {
    const { busqueda, fetch } = await buscar(CON_HUECO, { respuestas: [sepeSinOficinas('cargaTiposAtencionMapa')] })

    // El SEPE ha contestado: eso no es `sin-agenda`, que está reservado al
    // cuerpo vacío. Importa porque lo que endurece el freno son los vacíos, y
    // endurecerlo con respuestas legítimas frenaría por nada.
    expect(busqueda.estado).toBe('ok')
    expect(busqueda.oficinas).toEqual([])
    // Sin canales que ofrecer no hay a quién hacerle la segunda llamada.
    expect(vecesQueSePidio(fetch, 'cargaOficinasMapa')).toBe(0)
  })

  it('un HTML de error se reintenta con sesión nueva, y a la segunda sale bien', async () => {
    const { busqueda, fetch } = await buscar(CON_HUECO, { respuestas: [sepeSaturado('cargaTiposAtencionMapa', 1)] })

    expect(busqueda.estado).toBe('ok')
    expect(busqueda.oficinas).toHaveLength(46)
    expect(vecesQueSePidio(fetch, 'cargaTiposAtencionMapa')).toBe(2)
    expect(sesionesAbiertas(fetch)).toBe(2)
  })

  it('a la tercera se rinde con `sepe-no-responde`', async () => {
    const { busqueda, fetch } = await buscar(CON_HUECO, { respuestas: [sepeSaturado('cargaTiposAtencionMapa', 3)] })

    expect(busqueda.estado).toBe('sepe-no-responde')
    expect(busqueda.oficinas).toEqual([])
    expect(vecesQueSePidio(fetch, 'cargaTiposAtencionMapa')).toBe(3)
    expect(sesionesAbiertas(fetch)).toBe(3)
  })
})

describe('el trato con el SEPE', () => {
  it('abre una sesión por búsqueda y no la arrastra a la siguiente', async () => {
    const montaje = montar()

    // Dos trámites distintos, y no dos veces el mismo, porque el mismo saldría
    // de la caché: sin consulta no hay sesión que mirar.
    await dejarCorrer(montaje.reloj, montaje.app.buscador.buscar(CON_HUECO))
    await dejarCorrer(montaje.reloj, montaje.app.buscador.buscar(SIN_HUECO))

    expect(sesionesAbiertas(montaje.fetch)).toBe(2)
  })

  it('nunca lanza dos peticiones con menos de 2,5 segundos entre ellas, y la pausa lleva jitter', async () => {
    const montaje = montar()

    // Dos búsquedas de trámites distintos: cinco peticiones al SEPE contando
    // las portadas, que es de donde salen las cuatro pausas que se miden.
    // Repetir una consulta no serviría: la segunda vez sale de la caché.
    for (const consulta of [CON_HUECO, SIN_HUECO]) {
      await dejarCorrer(montaje.reloj, montaje.app.buscador.buscar(consulta))
    }

    const instantes = alSepe(montaje.fetch).map((l) => l.instante)
    const pausas = instantes.slice(1).map((instante, i) => instante - instantes[i])

    expect(pausas).toHaveLength(4)
    expect(Math.min(...pausas)).toBeGreaterThanOrEqual(PAUSA_MINIMA_MS)
    // Que la pausa lleve jitter es que alguna pase del mínimo —una petición
    // cada 2,5 segundos clavados no la hace ningún humano, y es justo el patrón
    // que se detecta— sin pasar nunca del techo.
    expect(Math.max(...pausas)).toBeGreaterThan(PAUSA_MINIMA_MS)
    expect(Math.max(...pausas)).toBeLessThanOrEqual(PAUSA_MINIMA_MS + JITTER_MAXIMO_MS)
  })
})
