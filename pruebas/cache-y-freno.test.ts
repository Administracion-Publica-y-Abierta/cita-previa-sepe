import { describe, expect, it } from 'vitest'
import { crearAlmacenEnMemoria } from '@/almacen/en-memoria'
import { CONFIGURACION_POR_DEFECTO } from '@/nucleo/configuracion'
import type { Busqueda } from '@/sepe/buscador'
import {
  crearFrenoCompartido,
  JITTER_MAXIMO_MS,
  PAUSA_MINIMA_MS,
  SinFicha,
  TECHO_MS,
  type Freno,
} from '@/sepe/freno'
import { dejarCorrer } from './ayudantes/dejar-correr'
import type { FetchFalso, RespuestaAMano } from './ayudantes/fetch-falso'
import { geocodificadorConoce } from './ayudantes/geocodificador-falso'
import {
  INSTANTE_DE_LAS_CAPTURAS,
  montarApp,
  otraInvocacion,
  type AppDePrueba,
  type OpcionesDeMontaje,
} from './ayudantes/montar-app'
import { crearRelojFalso, type RelojFalso } from './ayudantes/reloj-falso'
import { portadaDelSepe, sepeCuerpoVacio, sepeSaturado } from './ayudantes/sepe-falso'

/** El trámite grabado con agenda: 46 oficinas, 37 con hueco. */
const CON_HUECO = { codigoPostal: '08402', idTramite: 631 }

/** El otro trámite grabado, que sale por la segunda puerta del mapa. */
const OTRO = { codigoPostal: '08401', idTramite: 23 }

/** Los dos códigos postales de las capturas caen en Granollers. */
const GRANOLLERS = { municipio: 'Granollers', lat: 41.6083, lng: 2.2875 }

/**
 * Otro código postal de la misma provincia, a cuarenta y tantos kilómetros.
 * Es el par que hace falta para probar la clave ensanchada: misma provincia,
 * coordenadas bien distintas.
 */
const MANRESA = { codigoPostal: '08240', municipio: 'Manresa', lat: 41.723, lng: 1.8267 }

/**
 * Trámites que no existen en las grabaciones y a los que se contesta con el
 * cuerpo vacío. Sirven para provocar la racha de vacíos que endurece el freno
 * sin tocar los dos trámites grabados, que tienen que seguir contestando bien.
 */
const VACIOS = [991, 992, 993, 994, 995, 996, 997, 998]

function montar(opciones: OpcionesDeMontaje = {}): AppDePrueba {
  return montarApp({
    ...opciones,
    respuestas: [
      ...(opciones.respuestas ?? []),
      portadaDelSepe(),
      geocodificadorConoce('08401', GRANOLLERS),
      geocodificadorConoce('08402', GRANOLLERS),
      geocodificadorConoce(MANRESA.codigoPostal, MANRESA),
    ],
  })
}

/** Otra invocación del mismo despliegue, con las mismas respuestas puestas a mano. */
function otra(previa: AppDePrueba, opciones: OpcionesDeMontaje = {}): AppDePrueba {
  return otraInvocacion(previa, {
    ...opciones,
    respuestas: [
      ...(opciones.respuestas ?? []),
      portadaDelSepe(),
      geocodificadorConoce('08401', GRANOLLERS),
      geocodificadorConoce('08402', GRANOLLERS),
      geocodificadorConoce(MANRESA.codigoPostal, MANRESA),
    ],
  })
}

/** El SEPE contesta con el cuerpo vacío, pero solo a estos trámites. */
function vaciosPara(idsTramite: number[]): RespuestaAMano[] {
  return idsTramite.map((id) => ({
    ...sepeCuerpoVacio('cargaTiposAtencionMapa'),
    cuando: { idGrupoServicio: String(id) },
  }))
}

/** Solo las peticiones al SEPE: las del geocodificador no llevan freno. */
function alSepe(fetch: FetchFalso) {
  return fetch.llamadas.filter((l) => l.url.includes('citapreviasepe'))
}

/** Cuántas veces se le ha preguntado de verdad al SEPE por un trámite. */
function consultas(fetch: FetchFalso): number {
  return fetch.llamadas.filter((l) => l.endpoint === 'cargaTiposAtencionMapa').length
}

function pausasEntre(instantes: number[]): number[] {
  return instantes.slice(1).map((instante, i) => instante - instantes[i])
}

/** Deja el reloj en el instante en que la respuesta guardada tenga esta edad. */
async function envejecer(reloj: RelojFalso, busqueda: Busqueda, edadMs: number): Promise<void> {
  const salto = busqueda.consultadoEn + edadMs - reloj.ahora()
  if (salto < 0) throw new Error('La respuesta ya es más vieja que la edad que se le pide.')
  await reloj.avanzar(salto)
}

function buscar(montaje: AppDePrueba, consulta: { codigoPostal: string; idTramite: number }) {
  return dejarCorrer(montaje.reloj, montaje.app.buscador.buscar(consulta))
}

/**
 * Deja el freno como lo habría dejado otra invocación: con una racha de vacíos
 * detrás y una ficha recién repartida.
 *
 * Va por el almacén compartido, que es justo lo que se quiere enseñar: esta
 * invocación no ha visto ninguno de esos vacíos y aun así le toca frenar. Se
 * hace así y no encadenando búsquedas vacías porque con el ritmo ya doblado el
 * jitter decide si la siguiente petición cabe o no en el plazo, y un test no
 * puede depender de esa moneda.
 */
async function frenoEndurecidoPorOtraInvocacion(montaje: AppDePrueba): Promise<void> {
  const freno = crearFrenoCompartido({ almacen: montaje.almacen, reloj: montaje.reloj })
  for (let i = 0; i < 20; i += 1) await freno.anotar('vacia')
  await dejarCorrer(montaje.reloj, freno.fichar())
}

describe('la caché compartida de consultas', () => {
  it('dos peticiones idénticas a la vez son una sola llamada al SEPE', async () => {
    const montaje = montar()

    const [una, otra] = await dejarCorrer(
      montaje.reloj,
      Promise.all([
        montaje.app.buscador.buscar(CON_HUECO),
        montaje.app.buscador.buscar(CON_HUECO),
      ]),
    )

    expect(consultas(montaje.fetch)).toBe(1)
    expect(una.oficinas).toHaveLength(46)
    expect(otra.oficinas).toHaveLength(46)
  })

  it('dos invocaciones distintas a la vez tampoco consultan dos veces', async () => {
    // Este es el caso de verdad, y el que una promesa guardada en memoria no
    // cubre: en serverless las dos peticiones simultáneas caen en procesos
    // distintos que no se conocen. Lo único que comparten es el almacén.
    const primera = montar()
    const segunda = otra(primera)

    const [una, dos] = await dejarCorrer(
      primera.reloj,
      Promise.all([
        primera.app.buscador.buscar(CON_HUECO),
        segunda.app.buscador.buscar(CON_HUECO),
      ]),
    )

    expect(consultas(primera.fetch) + consultas(segunda.fetch)).toBe(1)
    expect(una.oficinas).toHaveLength(46)
    expect(dos.oficinas).toHaveLength(46)
  })

  it('dentro del TTL no se vuelve a llamar al SEPE', async () => {
    const montaje = montar()
    const primera = await buscar(montaje, CON_HUECO)
    const alSepeAntes = alSepe(montaje.fetch).length

    // Cinco segundos por debajo del TTL, y no un milisegundo: el reloj falso
    // avanza a saltos de medio segundo mientras la búsqueda corre, así que
    // pegarse al borde probaría la granularidad del ayudante y no la caché.
    await envejecer(montaje.reloj, primera, CONFIGURACION_POR_DEFECTO.ttlMs - 5_000)
    const segunda = await buscar(montaje, CON_HUECO)

    expect(alSepe(montaje.fetch)).toHaveLength(alSepeAntes)
    expect(segunda.desdeCache).toBe(true)
    expect(segunda.caducada).toBe(false)
    expect(segunda.oficinas).toHaveLength(46)
  })

  it('pasado el TTL se vuelve a consultar', async () => {
    const montaje = montar()
    const primera = await buscar(montaje, CON_HUECO)

    await envejecer(montaje.reloj, primera, CONFIGURACION_POR_DEFECTO.ttlMs)
    const segunda = await buscar(montaje, CON_HUECO)

    expect(consultas(montaje.fetch)).toBe(2)
    expect(segunda.desdeCache).toBe(false)
  })

  it('el TTL arranca en noventa segundos y se cambia por configuración', async () => {
    expect(CONFIGURACION_POR_DEFECTO.ttlMs).toBe(90_000)

    const montaje = montar({ configuracion: { ttlMs: 10_000 } })
    const primera = await buscar(montaje, CON_HUECO)

    // A los once segundos: con el TTL de fábrica esto seguiría en la caché.
    await envejecer(montaje.reloj, primera, 11_000)
    const segunda = await buscar(montaje, CON_HUECO)

    expect(consultas(montaje.fetch)).toBe(2)
    expect(segunda.desdeCache).toBe(false)
  })

  it('guarda el instante real de la consulta, y ese instante viaja en la respuesta', async () => {
    const montaje = montar()
    const primera = await buscar(montaje, CON_HUECO)

    await envejecer(montaje.reloj, primera, 30_000)
    const segunda = await buscar(montaje, CON_HUECO)

    // Servir de la caché no rejuvenece el dato: lo que se enseña es de cuándo
    // se le preguntó al SEPE, no de cuándo se contestó a quien pregunta.
    expect(segunda.consultadoEn).toBe(primera.consultadoEn)
    expect(primera.consultadoEn).toBeLessThanOrEqual(montaje.reloj.ahora())
  })

  it('con el SEPE caído sirve la última respuesta buena, marcada como vieja', async () => {
    const primera = montar()
    const buena = await buscar(primera, CON_HUECO)

    await envejecer(primera.reloj, buena, CONFIGURACION_POR_DEFECTO.ttlMs)
    // Otra invocación, ya con el SEPE contestando su página de saturación.
    const conElSepeCaido = otra(primera, { respuestas: [sepeSaturado('cargaTiposAtencionMapa')] })
    const vieja = await buscar(conElSepeCaido, CON_HUECO)

    expect(vieja.estado).toBe('ok')
    expect(vieja.caducada).toBe(true)
    expect(vieja.desdeCache).toBe(true)
    expect(vieja.oficinas).toHaveLength(46)
    expect(vieja.consultadoEn).toBe(buena.consultadoEn)
  })
})

describe('el ancho de la clave de la caché', () => {
  it('por código postal, dos códigos de la misma provincia consultan dos veces', async () => {
    // La clave de fábrica: obviamente correcta y con peor tasa de acierto.
    expect(CONFIGURACION_POR_DEFECTO.anchoDeClave).toBe('codigo-postal')

    const montaje = montar({
      respuestas: [
        {
          endpoint: 'cargaTiposAtencionMapa',
          cuando: { codigoPostal: MANRESA.codigoPostal },
          tipoContenido: 'application/json; charset=UTF-8',
          cuerpo: JSON.stringify({ listTipoAtencion: [], listaOficina: [] }),
        },
      ],
    })

    await buscar(montaje, OTRO)
    await buscar(montaje, { codigoPostal: MANRESA.codigoPostal, idTramite: OTRO.idTramite })

    expect(consultas(montaje.fetch)).toBe(2)
  })

  it('por provincia, una sola consulta y las distancias de cada uno', async () => {
    const montaje = montar({ configuracion: { anchoDeClave: 'provincia' } })

    const desdeGranollers = await buscar(montaje, OTRO)
    const desdeManresa = await buscar(montaje, {
      codigoPostal: MANRESA.codigoPostal,
      idTramite: OTRO.idTramite,
    })

    expect(consultas(montaje.fetch)).toBe(1)
    expect(desdeManresa.desdeCache).toBe(true)
    expect(desdeManresa.oficinas).toHaveLength(desdeGranollers.oficinas.length)

    // La lista es la misma; los kilómetros no. La distancia la calculamos
    // nosotros desde las coordenadas de quien pregunta, que es lo que permite
    // compartir una entrada sin contarle a nadie la distancia de otro.
    expect(desdeManresa.localizacion.municipio).toBe('Manresa')
    const mismas = desdeGranollers.oficinas.map((oficina, i) => [oficina.km, desdeManresa.oficinas[i].km])
    expect(mismas.every(([granollers, manresa]) => granollers !== manresa)).toBe(true)
  })
})

describe('el freno global', () => {
  it('el ritmo lo marca el almacén, no la memoria de cada invocación', async () => {
    // Dos invocaciones simultáneas preguntando por cosas distintas: no hay
    // caché que las junte, así que las cinco peticiones son de verdad. Si el
    // freno viviera en cada proceso, saldrían de dos en dos y a la vez.
    const primera = montar()
    const segunda = otra(primera)

    await dejarCorrer(
      primera.reloj,
      Promise.all([
        primera.app.buscador.buscar(CON_HUECO),
        segunda.app.buscador.buscar(OTRO),
      ]),
    )

    const instantes = [...alSepe(primera.fetch), ...alSepe(segunda.fetch)]
      .map((llamada) => llamada.instante)
      .sort((uno, otro) => uno - otro)
    const pausas = pausasEntre(instantes)

    expect(instantes).toHaveLength(5)
    expect(Math.min(...pausas)).toBeGreaterThanOrEqual(PAUSA_MINIMA_MS)
  })

  it('tres vacíos seguidos doblan el ritmo, y una respuesta buena lo devuelve a la normalidad', async () => {
    const montaje = montar({ respuestas: vaciosPara(VACIOS) })

    // Tres búsquedas vacías, una buena y otra más. En peticiones al SEPE:
    // portada y POST por búsqueda, salvo la última, que sale por la segunda
    // puerta del mapa y hace dos POST. Tres vacíos y no más: con el cuarto la
    // pausa se acercaría al plazo del freno y sería el jitter quien decidiera
    // si la búsqueda llega a hacerse.
    for (const idTramite of VACIOS.slice(0, 3)) {
      await buscar(montaje, { codigoPostal: '08402', idTramite })
    }
    await buscar(montaje, CON_HUECO)
    await buscar(montaje, OTRO)

    const pausas = pausasEntre(alSepe(montaje.fetch).map((llamada) => llamada.instante))

    expect(alSepe(montaje.fetch)).toHaveLength(11)
    // Las seis primeras se pidieron antes de que hubiera tres vacíos contados.
    expect(Math.max(...pausas.slice(0, 6))).toBeLessThanOrEqual(PAUSA_MINIMA_MS + JITTER_MAXIMO_MS)
    // La séptima es la primera con la racha ya contada: el ritmo va doblado.
    expect(pausas[6]).toBeGreaterThanOrEqual(2 * PAUSA_MINIMA_MS)
    // Y la primera de después de la respuesta buena vuelve al ritmo de siempre.
    expect(pausas[8]).toBeLessThanOrEqual(PAUSA_MINIMA_MS + JITTER_MAXIMO_MS)
  })

  it('sin ficha en un plazo razonable se pide volver en un momento, y no se llama al SEPE', async () => {
    const montaje = montar()

    await frenoEndurecidoPorOtraInvocacion(montaje)
    const antes = alSepe(montaje.fetch).length
    const rendida = await buscar(montaje, CON_HUECO)

    expect(rendida.estado).toBe('vuelve-en-un-momento')
    expect(rendida.oficinas).toEqual([])
    // Ni una petición: no hay caché que servir y aun así el freno no se salta.
    expect(alSepe(montaje.fetch)).toHaveLength(antes)
  })

  it('sin ficha, antes lo caducado que nada', async () => {
    const montaje = montar()
    const buena = await buscar(montaje, CON_HUECO)

    await frenoEndurecidoPorOtraInvocacion(montaje)
    await envejecer(montaje.reloj, buena, CONFIGURACION_POR_DEFECTO.ttlMs)
    const antes = alSepe(montaje.fetch).length
    const vieja = await buscar(montaje, CON_HUECO)

    expect(vieja.estado).toBe('ok')
    expect(vieja.caducada).toBe(true)
    expect(vieja.consultadoEn).toBe(buena.consultadoEn)
    expect(vieja.oficinas).toHaveLength(46)
    expect(alSepe(montaje.fetch)).toHaveLength(antes)
  })
})

describe('el techo del freno', () => {
  function frenoSuelto(): { freno: Freno; reloj: RelojFalso } {
    // Aquí no hay aplicación: el techo de dos minutos solo se ve desde el
    // freno. Por encima no llega a notarse, porque quien pide ficha se rinde
    // antes —a los quince segundos— y deja de haber vacíos que lo endurezcan.
    const reloj = crearRelojFalso(INSTANTE_DE_LAS_CAPTURAS)
    return { freno: crearFrenoCompartido({ almacen: crearAlmacenEnMemoria(reloj), reloj }), reloj }
  }

  it('por muchos vacíos que haya, la pausa no pasa de dos minutos', async () => {
    const { freno, reloj } = frenoSuelto()
    for (let i = 0; i < 20; i += 1) await freno.anotar('vacia')

    await freno.fichar() // la ficha estaba libre: esta no espera a nadie

    // Con veinte vacíos y sin techo, doblar daría más de tres minutos y a los
    // dos seguiría sin haber ficha.
    await reloj.avanzar(TECHO_MS)
    await expect(freno.fichar()).resolves.toBeUndefined()
  })

  it('y mientras tanto no deja pasar a nadie', async () => {
    const { freno } = frenoSuelto()
    for (let i = 0; i < 20; i += 1) await freno.anotar('vacia')
    await freno.fichar()

    await expect(freno.fichar()).rejects.toBeInstanceOf(SinFicha)
  })
})
