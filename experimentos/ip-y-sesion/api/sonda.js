import { abrirSesion, ipDeSalida, usarSesion } from '../sonda.mjs'

/**
 * La sonda desplegada. Un paso por invocación, y ese es el asunto entero: lo
 * que se quiere saber no es si el SEPE contesta, sino si le importa que las
 * dos mitades salgan de sitios distintos.
 *
 * Va por POST y no por GET aunque no lleve datos de nadie. Es la misma regla
 * de `pruebas/proteccion-de-datos.test.ts` —el alojamiento registra la URL
 * entera de cada petición— y un JSESSIONID en el registro de Vercel es una
 * sesión ajena escrita donde nadie la va a borrar.
 *
 * Nunca se reintenta dentro de una invocación (`intentos: 1`). Reintentar
 * querría decir abrir otra sesión, y entonces la cookie que se está probando
 * —la que vino de la otra invocación— ya no sería la que contesta. Lo que se
 * repite son las rondas, no las peticiones.
 */
export default async function sonda(peticion, respuesta) {
  if (peticion.method !== 'POST') {
    return responder(respuesta, 405, { error: 'solo POST' })
  }

  const { paso, jsessionid } = cuerpoDe(peticion)

  if (paso === 'abrir') {
    return responder(respuesta, 200, await abrirSesion())
  }

  if (paso === 'usar') {
    const salida = await usarSesion(jsessionid ?? null, { intentos: 1 })
    return responder(respuesta, 200, { ...salida, ip: await ipDeSalida() })
  }

  // El control, y sin él el experimento no se puede leer: con la cookie buena
  // y desde la misma IP el SEPE solo contesta una de cada tres veces, así que
  // un cero cruzado no distingue «la sesión está atada» de «hoy no contesta».
  // Lo que se compara son las dos tasas, y esta es la de referencia.
  if (paso === 'ambos') {
    const abierta = await abrirSesion()
    const salida = await usarSesion(abierta.jsessionid, { intentos: 1 })
    return responder(respuesta, 200, { ...salida, ip: await ipDeSalida(), ipAbrir: abierta.ip })
  }

  return responder(respuesta, 400, { error: 'paso ha de ser "abrir", "usar" o "ambos"' })
}

/** Vercel ya deja el JSON parseado en `body`; si llega crudo, se parsea aquí. */
function cuerpoDe(peticion) {
  if (peticion.body && typeof peticion.body === 'object') return peticion.body
  try {
    return JSON.parse(peticion.body ?? '{}')
  } catch {
    return {}
  }
}

function responder(respuesta, estado, cuerpo) {
  // Sin caché de ningún tipo: dos invocaciones que devolvieran la misma
  // respuesta guardada serían exactamente el resultado falso que se teme.
  respuesta.setHeader('cache-control', 'no-store')
  respuesta.setHeader('content-type', 'application/json')
  respuesta.status(estado).send(JSON.stringify(cuerpo))
}
