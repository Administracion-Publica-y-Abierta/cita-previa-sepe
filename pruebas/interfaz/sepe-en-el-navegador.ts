import { vi } from 'vitest'
import type { Localizacion } from '@/localizacion/geocodificador'
import type { EstadoDeLaCola } from '@/sepe/cola'
import type { EstadoDeLaConsulta } from '@/sepe/consultas'
import type { Subtramite } from '@/sepe/niveles'
import type { Oficina } from '@/sepe/oficinas'
import type { EventoDeLaPasada } from '@/sepe/pasada'

/**
 * La API contestando desde el navegador.
 *
 * Aquí la costura vuelve a ser el `fetch`, la misma de siempre: lo que se
 * prueba es la interfaz, y para la interfaz el servidor *es* una respuesta
 * HTTP. Lo que hay al otro lado —catálogo, freno, mapa, el troceado de la
 * pasada— ya se ejercita de verdad en `pruebas/pasada.test.ts`, entrando por
 * la ruta.
 *
 * Los tipos se importan del servidor a propósito: si la ruta cambiara de
 * forma, estos dobles dejarían de compilar en vez de seguir probando la
 * interfaz contra una respuesta que ya no existe.
 */

/** El instante de la segunda captura, el mismo con el que arrancan los tests del servidor. */
export const CONSULTADO_EN = Date.parse('2026-08-14T13:37:10+02:00')

const GRANOLLERS: Localizacion = {
  lat: 41.6083,
  lng: 2.2875,
  municipio: 'Granollers',
  provincia: 'Barcelona',
  precision: 'exacta',
}

/**
 * El caso degradado del geocodificador: no reconoce el código postal y se cae
 * al centro de la provincia. Hay resultados, pero los kilómetros son a ojo.
 */
export const CENTRO_DE_LA_PROVINCIA: Localizacion = {
  lat: 41.7,
  lng: 1.9,
  municipio: null,
  provincia: 'Barcelona',
  precision: 'aproximada-provincial',
}

const UN_TRAMITE: Subtramite = { id: 631, nombre: 'Voy a salir al extranjero' }

export function oficina(parcial: Partial<Oficina> = {}): Oficina {
  return {
    id: 5079,
    nombre: 'GRANOLLERS-PERIFERIA - SEPE',
    direccion: 'AVDA. MARIE CURIE, 25-27',
    telefono: '0901010210',
    horarioAtencion: '08:30 a 14:00',
    lat: 41.594542,
    lng: 2.289705,
    km: 1.42,
    primerHueco: '2026-08-17T09:00:00',
    idServicio: 631,
    servicio: 'Voy a salir al extranjero',
    oficinaVirtual: false,
    ...parcial,
  }
}

/** Qué trámites hay en la zona y desde dónde se miden los kilómetros. */
export function cola(
  tramites: Subtramite[],
  estado: EstadoDeLaCola = 'ok',
  localizacion: Localizacion = GRANOLLERS,
): EventoDeLaPasada {
  return { tipo: 'cola', estado, consultadoEn: CONSULTADO_EN, localizacion, tramites }
}

/** Un trámite resuelto, con lo que haya salido de él. */
export function resuelto(
  parcial: Partial<{
    tramite: Subtramite
    estado: EstadoDeLaConsulta
    desdeCache: boolean
    caducada: boolean
    /** Cuándo se le preguntó al SEPE. Distinto por trámite: cada uno se consulta a su hora. */
    consultadoEn: number
    oficinas: Oficina[]
  }> = {},
): EventoDeLaPasada {
  const { tramite, estado, desdeCache, caducada, consultadoEn, oficinas } = {
    tramite: UN_TRAMITE,
    estado: 'ok' as EstadoDeLaConsulta,
    desdeCache: false,
    caducada: false,
    consultadoEn: CONSULTADO_EN,
    oficinas: [oficina()],
    ...parcial,
  }

  return {
    tipo: 'tramite',
    idTramite: tramite.id,
    nombreTramite: tramite.nombre,
    canal: { id: 1, nombre: 'Presencial' },
    consultadoEn,
    desdeCache,
    caducada,
    estado,
    oficinas,
  }
}

/** Se está consultando este trámite: el aviso que sale antes de cada espera. */
export function consultando(tramite: Subtramite): EventoDeLaPasada {
  return { tipo: 'consultando', idTramite: tramite.id, nombreTramite: tramite.nombre }
}

/**
 * Una pasada de un solo trámite, que es el caso de casi todos los tests: la
 * cola, el aviso y el resultado.
 */
export function pasadaDeUnTramite(
  parcial: Parameters<typeof resuelto>[0] & { localizacion?: Localizacion } = {},
): EventoDeLaPasada[] {
  const tramite = parcial.tramite ?? UN_TRAMITE
  return [cola([tramite], 'ok', parcial.localizacion), consultando(tramite), resuelto(parcial)]
}

/** Una pasada que no llega a tener trámites que consultar. */
export function pasadaSinCola(estado: EstadoDeLaCola): EventoDeLaPasada[] {
  return [cola([], estado)]
}

/** La única ruta que la interfaz tiene permiso para llamar. */
const RUTA = '/api/busqueda'

/** Lo que se le ha pedido a la API, para poder comprobar que no se pide de más. */
export interface ApiFalsa {
  peticiones: { url: string; cuerpo: unknown }[]
}

/**
 * Igual que el `fetch` falso del servidor: si le piden algo que no sabe
 * contestar, revienta diciéndolo en vez de devolver algo que valga.
 *
 * Sin esto, una interfaz que empezara a llamar a otra ruta seguiría pasando
 * todos los tests, porque este doble contestaba lo mismo a cualquier URL.
 */
function exigirLaRuta(url: string): void {
  if (url !== RUTA) {
    throw new Error(`La interfaz ha llamado a ${url}, y la única ruta que tiene que llamar es ${RUTA}.`)
  }
}

const CABECERAS = { 'content-type': 'application/x-ndjson; charset=utf-8' }

/** Un objeto JSON por línea, que es lo que manda la ruta. */
function enLineas(eventos: EventoDeLaPasada[]): string {
  return eventos.map((evento) => `${JSON.stringify(evento)}\n`).join('')
}

function apuntar(api: ApiFalsa, entrada: RequestInfo | URL, opciones?: RequestInit): void {
  const url = String(entrada)
  exigirLaRuta(url)
  api.peticiones.push({ url, cuerpo: JSON.parse(String(opciones?.body ?? 'null')) })
}

/**
 * Pone un `fetch` que contesta la pasada de golpe y apunta lo que se le pidió.
 *
 * De golpe es un caso real —una pasada que cabe en una respuesta corta— y es
 * el que deja los tests que no van de progresividad tan cortos como estaban.
 * Para mirar la pantalla **a mitad** está `apiQueVaContando`.
 */
export function apiQueContesta(
  contestar: EventoDeLaPasada[] | { estado: number; cuerpo: unknown },
): ApiFalsa {
  const api: ApiFalsa = { peticiones: [] }

  vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    apuntar(api, entrada, opciones)

    if (Array.isArray(contestar)) return new Response(enLineas(contestar), { headers: CABECERAS })

    return new Response(JSON.stringify(contestar.cuerpo), {
      status: contestar.estado,
      headers: { 'content-type': 'application/json' },
    })
  })

  return api
}

/**
 * Una API que nunca contesta.
 *
 * Es la única forma de mirar la pantalla mientras se busca sin carreras: con
 * una respuesta inmediata, el estado de «buscando» dura menos que la
 * comprobación.
 */
export function apiQueNoContesta(): ApiFalsa {
  const api: ApiFalsa = { peticiones: [] }

  vi.stubGlobal('fetch', (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    apuntar(api, entrada, opciones)
    return new Promise<Response>(() => {})
  })

  return api
}

/**
 * Una API a la que no se llega.
 *
 * El `fetch` del navegador no contesta con un estado cuando no hay red: revienta.
 * Es el caso que hay que poder mirar —quedarse girando para siempre es la
 * alternativa— y no se puede montar con una respuesta.
 */
export function apiSinConexion(): ApiFalsa {
  const api: ApiFalsa = { peticiones: [] }

  vi.stubGlobal('fetch', (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    apuntar(api, entrada, opciones)
    return Promise.reject(new TypeError('Failed to fetch'))
  })

  return api
}

/** Una pasada que va soltando eventos cuando el test lo diga, y no antes. */
export interface ApiQueVaContando extends ApiFalsa {
  /** Suelta un evento por el streaming que ya está abierto. */
  contar(evento: EventoDeLaPasada): void
  /** Cierra la respuesta: la búsqueda ha terminado. */
  cerrar(): void
  /**
   * Corta el streaming a la mitad, como una conexión que se cae.
   *
   * No es lo mismo que `cerrar`: ahí la pasada terminó bien. Aquí quedaban
   * trámites por llegar y ya no van a llegar.
   */
  romper(): void
}

/**
 * La API contando la pasada poco a poco.
 *
 * Hace falta para lo único que no se puede probar de otra forma: que la lista
 * y el mapa aparezcan con el **primer** trámite y que los siguientes entren
 * según llegan, en vez de aparecer todo de golpe al final.
 */
export function apiQueVaContando(): ApiQueVaContando {
  const codificador = new TextEncoder()
  let mando: ReadableStreamDefaultController<Uint8Array> | null = null

  const api: ApiQueVaContando = {
    peticiones: [],
    contar(evento) {
      mando?.enqueue(codificador.encode(`${JSON.stringify(evento)}\n`))
    },
    cerrar() {
      mando?.close()
      mando = null
    },
    romper() {
      mando?.error(new TypeError('network error'))
      mando = null
    },
  }

  vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    apuntar(api, entrada, opciones)
    const cuerpo = new ReadableStream<Uint8Array>({
      start(control) {
        mando = control
      },
    })
    return new Response(cuerpo, { headers: CABECERAS })
  })

  return api
}

/**
 * Una API que contesta una cosa distinta a cada petición.
 *
 * Es lo que hace falta para probar lo que el servidor hace de verdad cuando la
 * pasada no le cabe en una invocación: cerrar diciendo lo que falta, y que la
 * pantalla vuelva a pedir **eso** y no la búsqueda entera.
 */
export function apiQueContestaPorTurnos(tandas: EventoDeLaPasada[][]): ApiFalsa {
  const api: ApiFalsa = { peticiones: [] }

  vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    apuntar(api, entrada, opciones)
    const tanda = tandas[api.peticiones.length - 1] ?? []
    return new Response(enLineas(tanda), { headers: CABECERAS })
  })

  return api
}

/** Lo que el servidor manda al cerrar sin haber terminado. */
export function pendientes(tramites: Subtramite[]): EventoDeLaPasada {
  return { tipo: 'pendientes', tramites }
}

/** Una respuesta que llega cuando el test lo diga, y no antes. */
export interface ApiALaEspera extends ApiFalsa {
  /** Contesta a la búsqueda número `cual` (empezando por 0) con esos eventos. */
  contestar(cual: number, eventos: EventoDeLaPasada[]): void
}

/**
 * Una API que deja al test decidir **en qué orden** contestan las búsquedas.
 *
 * Hace falta para lo que no se puede probar de otra forma: que una respuesta
 * que llega tarde no pise a la búsqueda que se pidió después.
 */
export function apiQueContestaCuandoSeLeDiga(): ApiALaEspera {
  const pendientes: ((respuesta: Response) => void)[] = []
  const api: ApiALaEspera = {
    peticiones: [],
    contestar(cual, eventos) {
      pendientes[cual](new Response(enLineas(eventos), { headers: CABECERAS }))
    },
  }

  vi.stubGlobal('fetch', (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    apuntar(api, entrada, opciones)
    return new Promise<Response>((resolver) => pendientes.push(resolver))
  })

  return api
}
