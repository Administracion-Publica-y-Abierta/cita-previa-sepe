import { describe, expect, it } from 'vitest'
import { crearAlmacenRedis } from '@/almacen/redis'
import { POST } from '@/app/api/busqueda/route'
import { deNdjson } from '@/nucleo/ndjson'
import { PAUSA_MINIMA_MS } from '@/sepe/freno'
import type { EventoDeLaPasada } from '@/sepe/pasada'
import { dejarCorrer } from './ayudantes/dejar-correr'
import { alSepe, type FetchFalso } from './ayudantes/fetch-falso'
import { geocodificadorConoce } from './ayudantes/geocodificador-falso'
import { montarApp, type AppDePrueba, type OpcionesDeMontaje } from './ayudantes/montar-app'
import { crearRedisAveriado, FICHA_DE_REDIS, URL_DE_REDIS } from './ayudantes/redis-falso'
import {
  mapaDelSepe,
  nivelesDelSepe,
  portadaDelSepe,
  sepeCuerpoVacio,
  sepeSaturado,
  subtramitesDelSepe,
} from './ayudantes/sepe-falso'

/**
 * La pasada: los trámites de una zona consultados en cola, contando cada uno en
 * cuanto se sabe.
 *
 * Lo que se prueba aquí es el comportamiento que se ve desde fuera: qué llega,
 * en qué orden y cuántas veces se ha llamado al SEPE cuando llega. Se entra por
 * la ruta de verdad, que es el patrón de este repositorio, y se lee el
 * streaming como lo lee el navegador.
 */

/** Los dos códigos postales de las capturas caen en Granollers. */
const GRANOLLERS = { municipio: 'Granollers', lat: 41.6083, lng: 2.2875 }

/** El trámite grabado con agenda: 46 oficinas, 37 con hueco. */
const CON_HUECO = 631

/** El trámite grabado sin un solo hueco: 46 oficinas, ninguna con hora. */
const SIN_HUECO = 23

const URL_DE_LA_RUTA = 'http://localhost/api/busqueda'

/** El trámite de nivel 2 del que cuelgan los subtrámites de `arbolCon`. */
const EL_GRUPO = { id: 901, nombre: 'Un trámite' }

/** Un árbol de una rama y un trámite, cuyos subtrámites son los que se le digan. */
function arbolCon(subtramites: { id: number; nombre: string }[]) {
  return [
    nivelesDelSepe(1, '', [{ id: 900, nombre: 'PRESTACIONES' }]),
    nivelesDelSepe(2, '900', [EL_GRUPO]),
    subtramitesDelSepe(901, subtramites),
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

function peticion(codigoPostal: string, tramites?: number[]): Request {
  return new Request(URL_DE_LA_RUTA, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(tramites ? { cp: codigoPostal, tramites } : { cp: codigoPostal }),
  })
}

/** Cuántas veces se le ha pedido el mapa al SEPE: una por trámite consultado. */
function consultasAlMapa(fetch: FetchFalso): number {
  return alSepe(fetch).filter((llamada) => llamada.endpoint === 'cargaTiposAtencionMapa').length
}

/**
 * Lee el streaming entero mientras corre el reloj, y deja mirar la aplicación
 * en el momento exacto en que llega cada evento. Eso último es lo que permite
 * probar que el primer trámite sale sin esperar a los demás: contando cuántas
 * veces se había llamado al SEPE justo entonces.
 */
async function leerLaPasada(
  montaje: AppDePrueba,
  respuesta: Response,
  alLlegar: (evento: EventoDeLaPasada) => void = () => {},
): Promise<EventoDeLaPasada[]> {
  const eventos: EventoDeLaPasada[] = []
  if (!respuesta.body) return eventos

  await dejarCorrer(
    montaje.reloj,
    (async () => {
      for await (const evento of deNdjson<EventoDeLaPasada>(respuesta.body!)) {
        eventos.push(evento)
        alLlegar(evento)
      }
    })(),
  )

  return eventos
}

/** El camino completo: se monta, se entra por la ruta y se lee lo que va saliendo. */
async function buscar(codigoPostal: string, opciones: OpcionesDeMontaje = {}) {
  const montaje = montar(opciones)
  const respuesta = await POST(peticion(codigoPostal))
  const eventos = await leerLaPasada(montaje, respuesta)
  return { ...montaje, respuesta, eventos }
}

function losTramitesDe(eventos: EventoDeLaPasada[]) {
  return eventos.filter((evento) => evento.tipo === 'tramite')
}

function laCola(eventos: EventoDeLaPasada[]) {
  const cola = eventos.find((evento) => evento.tipo === 'cola')
  if (!cola) throw new Error('La pasada no ha dicho qué había que consultar.')
  return cola
}

describe('la búsqueda progresiva', () => {
  it('cuenta el primer trámite sin haber consultado todavía los demás', async () => {
    const montaje = montar({
      respuestas: [
        ...arbolCon([
          { id: 501, nombre: 'El primero' },
          { id: 502, nombre: 'El segundo' },
        ]),
        mapaDelSepe(501, [{ idOficina: 1, primerHuecoDisponible: '2026-08-17, 09:00:00' }]),
        mapaDelSepe(502, [{ idOficina: 2 }]),
      ],
    })

    const respuesta = await POST(peticion('08401'))

    // Lo que hace que el mapa pueda aparecer con el primero: cuando llega su
    // evento solo se le ha pedido el mapa al SEPE **una** vez. Si hubiera que
    // esperar a la pasada entera, aquí habría tres.
    let consultasAlLlegarElPrimero: number | null = null
    const eventos = await leerLaPasada(montaje, respuesta, (evento) => {
      if (evento.tipo === 'tramite' && consultasAlLlegarElPrimero === null) {
        consultasAlLlegarElPrimero = consultasAlMapa(montaje.fetch)
      }
    })

    expect(consultasAlLlegarElPrimero).toBe(1)
    expect(losTramitesDe(eventos).map((evento) => evento.idTramite)).toEqual([501, 502])
    expect(losTramitesDe(eventos)[0].oficinas).toHaveLength(1)
  })

  it('avisa de qué trámite se está consultando antes de ponerse a esperar', async () => {
    const { eventos } = await buscar('08401', {
      respuestas: [
        ...arbolCon([
          { id: 501, nombre: 'El primero' },
          { id: 502, nombre: 'El segundo' },
        ]),
        mapaDelSepe(501, [{ idOficina: 1 }]),
        mapaDelSepe(502, [{ idOficina: 2 }]),
      ],
    })

    // Cada consulta se anuncia antes de hacerse y se cuenta después. Sin el
    // aviso de delante, la pantalla se queda callada los segundos que dura la
    // espera y parece colgada, que es justo lo que no puede pasar.
    expect(eventos.map((evento) => evento.tipo)).toEqual([
      'cola',
      'consultando',
      'tramite',
      'consultando',
      'tramite',
    ])
    expect(eventos[1]).toMatchObject({ idTramite: 501, nombreTramite: 'El primero' })
  })

  it('dice cuántos trámites hay en la zona, para poder decir cuánto falta', async () => {
    const { eventos } = await buscar('08401', {
      respuestas: [
        ...arbolCon([
          { id: 501, nombre: 'El primero' },
          { id: 502, nombre: 'El segundo' },
        ]),
        mapaDelSepe(501, [{ idOficina: 1 }]),
        mapaDelSepe(502, [{ idOficina: 2 }]),
      ],
    })

    // Cada trámite viaja con el trámite de nivel 2 del que cuelga: es la forma
    // en que el SEPE los agrupa en su sede —el combo «Trámite» y debajo el
    // combo «Subtrámite»— y es por ese par de nombres por el que quien pregunta
    // reconoce el suyo.
    expect(laCola(eventos).tramites).toEqual([
      { id: 501, nombre: 'El primero', grupo: { id: 901, nombre: 'Un trámite' } },
      { id: 502, nombre: 'El segundo', grupo: { id: 901, nombre: 'Un trámite' } },
    ])
  })

  it('el grupo de cada trámite es el que le pone el SEPE, y no uno nuestro', async () => {
    const { eventos } = await buscar('08401', {
      respuestas: [
        nivelesDelSepe(1, '', [{ id: 900, nombre: 'PRESTACIONES' }]),
        nivelesDelSepe(2, '900', [
          { id: 901, nombre: 'He finalizado un trabajo' },
          { id: 902, nombre: 'Estoy cobrando y ha cambiado mi situación' },
        ]),
        subtramitesDelSepe(901, [{ id: 501, nombre: 'De uno' }]),
        subtramitesDelSepe(902, [{ id: 502, nombre: 'Del otro' }]),
        mapaDelSepe(501, [{ idOficina: 1 }]),
        mapaDelSepe(502, [{ idOficina: 2 }]),
      ],
    })

    expect(laCola(eventos).tramites.map((tramite) => tramite.grupo.nombre)).toEqual([
      'He finalizado un trabajo',
      'Estoy cobrando y ha cambiado mi situación',
    ])
  })

  it('cada evento lleva su trámite, su canal, cuándo se preguntó, de dónde salió y qué pasó', async () => {
    const { eventos } = await buscar('08402', {
      respuestas: arbolCon([{ id: CON_HUECO, nombre: 'Voy a salir al extranjero' }]),
    })

    const [tramite] = losTramitesDe(eventos)
    expect(tramite).toMatchObject({
      idTramite: CON_HUECO,
      nombreTramite: 'Voy a salir al extranjero',
      // El canal es del SEPE: las oficinas que contesta son las de ese canal, y
      // sin decir cuál la lista no se puede leer del todo.
      canal: { id: 1, nombre: 'Presencial' },
      estado: 'ok',
      desdeCache: false,
      caducada: false,
    })
    expect(tramite.consultadoEn).toBeGreaterThan(0)
    expect(tramite.oficinas).toHaveLength(46)
    expect(tramite.oficinas.find((oficina) => oficina.id === 5079)).toMatchObject({
      nombre: 'GRANOLLERS-PERIFERIA - SEPE',
      direccion: 'AVDA. MARIE CURIE, 25-27',
      telefono: '0901010210',
      horarioAtencion: '08:30 a 14:00',
      primerHueco: '2026-08-17T09:00:00',
    })
    expect(typeof tramite.oficinas[0].km).toBe('number')
  })

  it('dice de dónde salen los kilómetros y con cuánta confianza', async () => {
    const { eventos } = await buscar('08402', {
      respuestas: arbolCon([{ id: CON_HUECO, nombre: 'Voy a salir al extranjero' }]),
    })

    expect(laCola(eventos).localizacion).toMatchObject({ municipio: 'Granollers', precision: 'exacta' })
  })

  it('un trámite sin ningún hueco es `ok` con la lista entera, no un error', async () => {
    const { eventos } = await buscar('08401', {
      respuestas: arbolCon([{ id: SIN_HUECO, nombre: 'El grabado sin huecos' }]),
    })

    const [tramite] = losTramitesDe(eventos)
    expect(tramite.estado).toBe('ok')
    expect(tramite.oficinas).toHaveLength(46)
    expect(tramite.oficinas.every((oficina) => oficina.primerHueco === null)).toBe(true)
  })

  it('la cola la ordena el SEPE, y no una lista nuestra', async () => {
    const { eventos } = await buscar('08401', {
      respuestas: [
        nivelesDelSepe(1, '', [{ id: 900, nombre: 'PRESTACIONES' }]),
        nivelesDelSepe(2, '900', [
          { id: 901, nombre: 'El trámite que el SEPE lista primero' },
          { id: 902, nombre: 'El segundo' },
        ]),
        subtramitesDelSepe(901, [{ id: 501, nombre: 'De la primera rama' }]),
        subtramitesDelSepe(902, [{ id: 502, nombre: 'De la segunda' }]),
        mapaDelSepe(501, [{ idOficina: 1 }]),
        mapaDelSepe(502, [{ idOficina: 2 }]),
      ],
    })

    expect(laCola(eventos).tramites.map((tramite) => tramite.id)).toEqual([501, 502])
  })

  it('se salta los trámites cuyo combo viene vacío en vez de pararse en ellos', async () => {
    const { eventos } = await buscar('08401', {
      respuestas: [
        nivelesDelSepe(1, '', [{ id: 900, nombre: 'PRESTACIONES' }]),
        nivelesDelSepe(2, '900', [
          { id: 901, nombre: 'Sin subtrámites' },
          { id: 902, nombre: 'Este sí tiene' },
        ]),
        subtramitesDelSepe(901, []),
        subtramitesDelSepe(902, [{ id: SIN_HUECO, nombre: 'El único consultable' }]),
      ],
    })

    expect(laCola(eventos).estado).toBe('ok')
    expect(laCola(eventos).tramites.map((tramite) => tramite.id)).toEqual([SIN_HUECO])
  })
})

describe('la pasada cuando un trámite va mal', () => {
  it('un SEPE caído sale como avería de ese trámite y la pasada sigue en pie', async () => {
    const { eventos } = await buscar('08401', {
      respuestas: [
        ...arbolCon([
          { id: 501, nombre: 'El que el SEPE no contesta' },
          { id: 502, nombre: 'El de después' },
        ]),
        // Tres intentos con sesión nueva cada uno: es lo que el cliente insiste
        // antes de darlo por caído, y por eso un trámite así se lleva por
        // delante el presupuesto de la invocación.
        { ...sepeSaturado('cargaTiposAtencionMapa', 3), cuando: { idGrupoServicio: '501' } },
        mapaDelSepe(502, [{ idOficina: 2 }]),
      ],
    })

    expect(losTramitesDe(eventos)[0]).toMatchObject({ idTramite: 501, estado: 'sepe-no-responde' })
    // La avería no corta el streaming: lo que no ha dado tiempo a consultar
    // queda dicho para la invocación siguiente en vez de perderse con el fallo.
    expect(eventos.at(-1)).toMatchObject({
      tipo: 'pendientes',
      tramites: [{ id: 502, nombre: 'El de después' }],
    })
  })

  it('un trámite sin agenda tampoco para la cola, y no se cuenta como avería', async () => {
    const { eventos } = await buscar('08401', {
      respuestas: [
        ...arbolCon([
          { id: 501, nombre: 'El que contesta vacío' },
          { id: 502, nombre: 'El de después' },
        ]),
        { ...sepeCuerpoVacio('cargaTiposAtencionMapa'), cuando: { idGrupoServicio: '501' } },
        mapaDelSepe(502, [{ idOficina: 2 }]),
      ],
    })

    expect(losTramitesDe(eventos).map((evento) => [evento.idTramite, evento.estado])).toEqual([
      [501, 'sin-agenda'],
      [502, 'ok'],
    ])
  })

  it('un código postal que no es español se rechaza sin salir al SEPE', async () => {
    const montaje = montar()
    const respuesta = await POST(peticion('99999'))

    expect(respuesta.status).toBe(400)
    expect(await respuesta.json()).toMatchObject({ error: 'codigo-postal-invalido' })
    expect(montaje.fetch.llamadas).toEqual([])
  })

  it('si el catálogo no se puede descubrir, no se inventa una cola', async () => {
    const { eventos, fetch } = await buscar('08401', {
      respuestas: [sepeCuerpoVacio('cargaComboNivelesTramitesCPEntidad')],
    })

    expect(laCola(eventos).estado).toBe('sin-agenda')
    expect(laCola(eventos).tramites).toEqual([])
    expect(losTramitesDe(eventos)).toEqual([])
    expect(consultasAlMapa(fetch)).toBe(0)
  })

  it('el SEPE caído mientras se descubre el catálogo sale como avería', async () => {
    const { eventos } = await buscar('08401', {
      respuestas: [sepeSaturado('cargaComboNivelesTramitesCPEntidad', 3)],
    })

    expect(laCola(eventos).estado).toBe('sepe-no-responde')
  })

  it('un árbol entero sin subtrámites es `sin-tramites`, y no una avería', async () => {
    const { eventos } = await buscar('08401', {
      respuestas: [
        nivelesDelSepe(1, '', [{ id: 900, nombre: 'PRESTACIONES' }]),
        nivelesDelSepe(2, '900', [{ id: 901, nombre: 'Sin subtrámites' }]),
        subtramitesDelSepe(901, []),
      ],
    })

    expect(laCola(eventos).estado).toBe('sin-tramites')
    expect(losTramitesDe(eventos)).toEqual([])
  })

  it('sin fichas del freno se pide volver en un momento, y no es un 500', async () => {
    // Descubrir un catálogo son diez fichas seguidas: es justo lo que se queda
    // sin ellas cuando el servicio va lleno. Con el almacén compartido caído no
    // hay forma de saber a quién le toca, así que no se llama al SEPE.
    const { respuesta, eventos, fetch } = await buscar('08401', {
      almacen: crearAlmacenRedis({
        fetch: crearRedisAveriado(),
        url: URL_DE_REDIS,
        ficha: FICHA_DE_REDIS,
      }),
    })

    expect(respuesta.status).toBe(200)
    expect(laCola(eventos).estado).toBe('vuelve-en-un-momento')
    expect(alSepe(fetch)).toEqual([])
  })
})

describe('lo que una invocación se permite', () => {
  it('no sostiene la pasada entera: lo que no cabe sale como pendiente', async () => {
    // Nueve trámites son unos 44 segundos con el freno, más de lo que aguanta
    // una función. La invocación consulta lo que le cabe y deja dicho el resto.
    const nueve = Array.from({ length: 9 }, (_, i) => ({ id: 501 + i, nombre: `Trámite ${i}` }))
    const { eventos } = await buscar('08401', {
      respuestas: [...arbolCon(nueve), ...nueve.map((tramite) => mapaDelSepe(tramite.id, [{ idOficina: tramite.id }]))],
    })

    const consultados = losTramitesDe(eventos)
    const pendientes = eventos.find((evento) => evento.tipo === 'pendientes')

    expect(consultados.length).toBeGreaterThan(0)
    expect(consultados.length).toBeLessThan(nueve.length)
    expect(pendientes).toBeDefined()
    // Lo que falta es exactamente lo que no se ha consultado, en el mismo orden.
    expect(pendientes?.tramites).toEqual(
      nueve.slice(consultados.length).map((tramite) => ({ ...tramite, grupo: EL_GRUPO })),
    )
    expect(eventos.at(-1)).toBe(pendientes)
  })

  it('la que continúa consulta lo que faltaba sin volver a descubrir el árbol', async () => {
    const nueve = Array.from({ length: 9 }, (_, i) => ({ id: 501 + i, nombre: `Trámite ${i}` }))
    const montaje = montar({
      respuestas: [...arbolCon(nueve), ...nueve.map((tramite) => mapaDelSepe(tramite.id, [{ idOficina: tramite.id }]))],
    })

    const primera = await leerLaPasada(montaje, await POST(peticion('08401')))
    const pendientes = primera.find((evento) => evento.tipo === 'pendientes')
    const hastaAqui = montaje.fetch.llamadas.length

    const segunda = await leerLaPasada(
      montaje,
      await POST(peticion('08401', pendientes?.tramites.map((tramite) => tramite.id))),
    )

    // El árbol se descubrió en la primera y se quedó en el almacén compartido:
    // volver a descubrirlo serían otras diez peticiones frenadas, y la
    // continuación no las paga.
    const enLaSegunda = montaje.fetch.llamadas.slice(hastaAqui)
    expect(enLaSegunda.filter((llamada) => llamada.endpoint === 'cargaComboNivelesTramitesCPEntidad')).toEqual([])

    // Y sigue por donde se quedó, con los nombres que dijo el SEPE y no los que
    // haya mandado quien pregunta: en la petición solo viajan identificadores.
    expect(losTramitesDe(segunda)[0]).toMatchObject({
      idTramite: pendientes?.tramites[0].id,
      nombreTramite: pendientes?.tramites[0].nombre,
    })
  })

  it('es una sola respuesta en streaming, y no una ronda de preguntas', async () => {
    const { respuesta, eventos } = await buscar('08401', {
      respuestas: [
        ...arbolCon([
          { id: 501, nombre: 'El primero' },
          { id: 502, nombre: 'El segundo' },
        ]),
        mapaDelSepe(501, [{ idOficina: 1 }]),
        mapaDelSepe(502, [{ idOficina: 2 }]),
      ],
    })

    expect(respuesta.headers.get('content-type')).toContain('application/x-ndjson')
    // Una petición, cinco eventos: la cola y los dos trámites con su aviso.
    expect(eventos).toHaveLength(5)
  })

  it('respeta el ritmo de 2,5 s durante toda la pasada', async () => {
    const { fetch } = await buscar('08401', {
      respuestas: [
        ...arbolCon([
          { id: 501, nombre: 'El primero' },
          { id: 502, nombre: 'El segundo' },
          { id: 503, nombre: 'El tercero' },
        ]),
        mapaDelSepe(501, [{ idOficina: 1 }]),
        mapaDelSepe(502, [{ idOficina: 2 }]),
        mapaDelSepe(503, [{ idOficina: 3 }]),
      ],
    })

    const instantes = alSepe(fetch).map((llamada) => llamada.instante)
    const pausas = instantes.slice(1).map((instante, i) => instante - instantes[i])

    expect(instantes.length).toBeGreaterThan(5)
    // Ni una sola por debajo, y no solo de media: la pasada no acelera al final
    // ni aunque quien pregunte lleve esperando medio minuto.
    expect(Math.min(...pausas)).toBeGreaterThanOrEqual(PAUSA_MINIMA_MS)
  })
})
