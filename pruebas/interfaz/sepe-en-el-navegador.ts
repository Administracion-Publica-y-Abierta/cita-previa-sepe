import { vi } from 'vitest'
import type { BusquedaDelPrimerTramite } from '@/sepe/primer-tramite'
import type { Oficina } from '@/sepe/oficinas'

/**
 * La API contestando desde el navegador.
 *
 * Aquí la costura vuelve a ser el `fetch`, la misma de siempre: lo que se
 * prueba es la interfaz, y para la interfaz el servidor *es* una respuesta
 * HTTP. Lo que hay al otro lado —catálogo, freno, mapa— ya se ejercita de
 * verdad en `pruebas/primer-tramite.test.ts`, entrando por la ruta.
 *
 * Los tipos se importan del servidor a propósito: si la ruta cambiara de
 * forma, estos dobles dejarían de compilar en vez de seguir probando la
 * interfaz contra una respuesta que ya no existe.
 */

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

export function respuesta(parcial: Partial<BusquedaDelPrimerTramite> = {}): BusquedaDelPrimerTramite {
  return {
    estado: 'ok',
    consultadoEn: Date.parse('2026-08-14T13:37:10+02:00'),
    tramite: { id: 631, nombre: 'Voy a salir al extranjero' },
    localizacion: {
      lat: 41.6083,
      lng: 2.2875,
      municipio: 'Granollers',
      provincia: 'Barcelona',
      precision: 'exacta',
    },
    oficinas: [oficina()],
    ...parcial,
  }
}

/** La única ruta que la interfaz tiene permiso para llamar. */
const RUTA = '/api/oficinas'

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

/**
 * Pone un `fetch` que contesta lo que se le diga y apunta lo que se le pidió.
 *
 * Contar las peticiones es como se prueba que el aviso de código postal
 * inválido sale **antes** de lanzar una búsqueda que iba a fallar.
 */
export function apiQueContesta(
  contestar: BusquedaDelPrimerTramite | { estado: number; cuerpo: unknown },
): ApiFalsa {
  const api: ApiFalsa = { peticiones: [] }

  vi.stubGlobal('fetch', async (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = String(entrada)
    exigirLaRuta(url)
    api.peticiones.push({ url, cuerpo: JSON.parse(String(opciones?.body ?? 'null')) })

    const esError = 'estado' in contestar && typeof contestar.estado === 'number'
    const { estado, cuerpo } = esError
      ? (contestar as { estado: number; cuerpo: unknown })
      : { estado: 200, cuerpo: contestar }

    return new Response(JSON.stringify(cuerpo), {
      status: estado,
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
    const url = String(entrada)
    exigirLaRuta(url)
    api.peticiones.push({ url, cuerpo: JSON.parse(String(opciones?.body ?? 'null')) })
    return new Promise<Response>(() => {})
  })

  return api
}

/** Una respuesta que llega cuando el test lo diga, y no antes. */
export interface ApiALaEspera extends ApiFalsa {
  /** Contesta a la consulta número `cual` (empezando por 0) con `cuerpo`. */
  contestar(cual: number, cuerpo: BusquedaDelPrimerTramite): void
}

/**
 * Una API que deja al test decidir **en qué orden** contestan las consultas.
 *
 * Hace falta para lo que no se puede probar de otra forma: que una respuesta
 * que llega tarde no pise a la búsqueda que se pidió después.
 */
export function apiQueContestaCuandoSeLeDiga(): ApiALaEspera {
  const pendientes: ((respuesta: Response) => void)[] = []
  const api: ApiALaEspera = {
    peticiones: [],
    contestar(cual, cuerpo) {
      pendientes[cual](
        new Response(JSON.stringify(cuerpo), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    },
  }

  vi.stubGlobal('fetch', (entrada: RequestInfo | URL, opciones?: RequestInit) => {
    const url = String(entrada)
    exigirLaRuta(url)
    api.peticiones.push({ url, cuerpo: JSON.parse(String(opciones?.body ?? 'null')) })
    return new Promise<Response>((resolver) => pendientes.push(resolver))
  })

  return api
}
