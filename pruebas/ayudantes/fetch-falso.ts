import type { Fetch } from '@/nucleo/dependencias'
import type { Reloj } from '@/nucleo/reloj'
import { cargarGrabaciones, type Grabacion } from './grabaciones'

/** Lo que el `fetch` falso apuntó de cada petición que le hicieron. */
export interface Llamada {
  endpoint: string
  url: string
  metodo: string
  parametros: Record<string, string>
  /** Según el reloj inyectado: es lo que permite comprobar el freno. */
  instante: number
  /** Clave de la grabación que contestó, o `null` si contestó un apaño del test. */
  grabacion: string | null
}

/** Una respuesta puesta a mano por un test, para los caminos que no hay grabados. */
export interface RespuestaAMano {
  endpoint: string
  /** Solo contesta si estos parámetros coinciden. Sin esto, contesta a todos. */
  cuando?: Record<string, string>
  estado?: number
  tipoContenido?: string
  cuerpo: string
  /** Cuántas veces contesta antes de dejar paso a la grabación. Por defecto, siempre. */
  veces?: number
}

/**
 * Se declara a partir de `Fetch` a propósito: si el `fetch` que espera la
 * aplicación cambiara de forma, esto dejaría de compilar en vez de dejar que
 * los tests se prueben contra algo que ya no existe.
 */
export type FetchFalso = Fetch & {
  /** Todas las peticiones, en orden. Contarlas es como se prueban el single-flight y la caché. */
  llamadas: Llamada[]
}

function endpointDe(url: string): string {
  return new URL(url).pathname.split('/').pop() ?? ''
}

function parametrosDe(url: string, opciones?: RequestInit): Record<string, string> {
  const params = new URLSearchParams(new URL(url).search)
  const cuerpo = opciones?.body
  if (typeof cuerpo === 'string') for (const [k, v] of new URLSearchParams(cuerpo)) params.set(k, v)
  else if (cuerpo instanceof URLSearchParams) for (const [k, v] of cuerpo) params.set(k, v)
  return Object.fromEntries(params)
}

function coincide(esperados: Record<string, string>, recibidos: Record<string, string>): boolean {
  return Object.entries(esperados).every(([clave, valor]) => (recibidos[clave] ?? '') === valor)
}

function noHayGrabacion(endpoint: string, parametros: Record<string, string>, grabaciones: Grabacion[]): Error {
  const delEndpoint = grabaciones.filter((g) => g.endpoint === endpoint)
  const detalle = delEndpoint.length
    ? `Hay ${delEndpoint.length} grabación(es) de ese endpoint, con otros parámetros:\n` +
      delEndpoint.map((g) => `  ${JSON.stringify(g.discriminadores)}  (${g.resumen})`).join('\n')
    : 'No hay ninguna grabación de ese endpoint. Endpoints grabados:\n' +
      [...new Set(grabaciones.map((g) => g.endpoint))].map((e) => `  ${e}`).join('\n')

  // Falla ruidosamente en vez de devolver algo vacío: una respuesta vacía del
  // SEPE es un caso real y con significado propio, y un test no debe poder
  // confundir "esto no está grabado" con "el SEPE no tenía agenda".
  //
  // El mensaje sí enseña los parámetros porque aquí solo hay código postal e
  // identificadores de trámite, y esto no se ejecuta nunca en producción. En
  // la aplicación la regla es la contraria: lo que se registra va limpio.
  return new Error(
    `El fetch falso no tiene respuesta para ${endpoint} con ${JSON.stringify(parametros)}.\n${detalle}\n` +
      'Si el caso es real, grábalo: npm run fixtures -- <ruta a los .har>.\n' +
      'Si es un caso inventado (un error, un timeout), pásalo en `respuestas` al montar la aplicación.',
  )
}

/**
 * Un `fetch` que contesta con tráfico real del SEPE en vez de salir a la red.
 *
 * Es la única costura del cliente SEPE y del geocodificador, así que todo lo
 * que hay por encima —parseo del HTML de los `<option>`, caché, freno,
 * filtros, rutas— se ejercita de verdad.
 */
export function crearFetchFalso(opciones: { reloj: Reloj; respuestas?: RespuestaAMano[] }): FetchFalso {
  const grabaciones = cargarGrabaciones()
  const aMano = (opciones.respuestas ?? []).map((r) => ({ ...r, usos: 0 }))

  const falso = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url
    const metodo = (init?.method ?? (entrada instanceof Request ? entrada.method : 'GET')).toUpperCase()
    const endpoint = endpointDe(url)
    const parametros = parametrosDe(url, init)

    const apano = aMano.find(
      (r) =>
        r.endpoint === endpoint &&
        (r.veces === undefined || r.usos < r.veces) &&
        coincide(r.cuando ?? {}, parametros),
    )
    if (apano) {
      apano.usos += 1
      falso.llamadas.push({ endpoint, url, metodo, parametros, instante: opciones.reloj.ahora(), grabacion: null })
      return new Response(apano.cuerpo, {
        status: apano.estado ?? 200,
        headers: { 'content-type': apano.tipoContenido ?? 'text/html; charset=UTF-8' },
      })
    }

    const grabada = grabaciones.find(
      (g) => g.endpoint === endpoint && coincide(g.discriminadores, parametros),
    )
    if (!grabada) throw noHayGrabacion(endpoint, parametros, grabaciones)

    falso.llamadas.push({
      endpoint,
      url,
      metodo,
      parametros,
      instante: opciones.reloj.ahora(),
      grabacion: grabada.clave,
    })
    return new Response(grabada.respuesta.cuerpo, {
      status: grabada.respuesta.estado,
      headers: { 'content-type': grabada.respuesta.tipoContenido },
    })
  }) as FetchFalso

  falso.llamadas = []
  return falso
}
