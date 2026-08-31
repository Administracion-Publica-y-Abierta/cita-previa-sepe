/**
 * Las dos mitades del experimento, sueltas y sin nada del proyecto detrás.
 *
 * Se duplica aquí lo que `src/sepe/cliente.ts` ya sabe hacer —cabeceras,
 * cuerpo de formulario, el JSESSIONID— porque lo que se está midiendo es
 * justamente lo que ese cliente da por imposible: que una sesión sobreviva a
 * la invocación. Montar el cliente de producción para medirlo obligaría a
 * montar también el freno y la caché, que aquí no pintan nada, y el resultado
 * hablaría del cliente y no del SEPE.
 */

const BASE = 'https://citaprevia-sede.sepe.gob.es/citapreviasepe'

/** La portada. Es donde el SEPE reparte la cookie de sesión. */
export const PORTADA = `${BASE}/?origen=sepe&codidioma=es`

const AGENTE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0'

/**
 * El ritmo de `CONTRIBUTING.md` manda también aquí, y con margen: son unas
 * pocas peticiones hechas a mano, y no hay ninguna prisa que justifique rozar
 * el mínimo medido de 2,5 s.
 */
export const PAUSA_MS = 3500

export const esperar = (ms) => new Promise((seguir) => setTimeout(seguir, ms))

/**
 * El código postal y el trámite salen de las capturas que ya están en el
 * repositorio (08401, «Información general»). No hay aquí ningún dato de
 * nadie: es una zona conocida de la que ya se sabe que contesta, y por eso una
 * respuesta que no llegue significa algo.
 */
export const ZONA = {
  codigoPostal: '08401',
  idGrupoServicio: 41,
  // Granollers. Al SEPE solo le sirven para ordenar por distancia.
  latOrigen: 41.6083,
  lngOrigen: 2.2874,
}

const COMUNES = {
  idCliente: 39,
  idsJerarquiaTramites: 5,
  tieneTramiteRelacionado: 0,
}

/** De dónde ha salido esta petición, visto desde fuera. */
export async function ipDeSalida() {
  try {
    const respuesta = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(8000),
    })
    return (await respuesta.json()).ip
  } catch {
    return 'desconocida'
  }
}

/** Primera mitad: pedir la portada y quedarse con la cookie que reparte. */
export async function abrirSesion() {
  const respuesta = await fetch(PORTADA, {
    headers: { 'user-agent': AGENTE, 'accept-language': 'es-ES,es;q=0.9' },
    signal: AbortSignal.timeout(20000),
  })

  const galleta = respuesta.headers
    .getSetCookie()
    .map((cruda) => cruda.split(';')[0].trim())
    .find((par) => par.startsWith('JSESSIONID='))

  return { estado: respuesta.status, jsessionid: galleta ?? null, ip: await ipDeSalida() }
}

async function postear(galleta, ruta, parametros) {
  const respuesta = await fetch(`${BASE}${ruta}`, {
    method: 'POST',
    headers: {
      'user-agent': AGENTE,
      accept: 'application/json, text/javascript, */*; q=0.01',
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'x-requested-with': 'XMLHttpRequest',
      origin: 'https://citaprevia-sede.sepe.gob.es',
      referer: PORTADA,
      'accept-language': 'es-ES,es;q=0.9',
      ...(galleta ? { cookie: galleta } : {}),
    },
    body: new URLSearchParams(
      Object.entries(parametros).map(([clave, valor]) => [clave, String(valor)]),
    ),
    signal: AbortSignal.timeout(20000),
  })

  return { estado: respuesta.status, cuerpo: await respuesta.text() }
}

/**
 * Segunda mitad: usar la cookie contra el mapa, y no darse por vencido al
 * primer cuerpo vacío.
 *
 * Insistir no es cortesía con el SEPE: es lo único que separa esta medición de
 * una moneda al aire. Está medido en este mismo repositorio que el mismo
 * trámite contesta vacío y con 46 oficinas con treinta segundos de diferencia,
 * así que un solo vacío no dice nada de la sesión ni de la IP —dice que ha
 * tocado un mal momento—. Lo que se busca es una respuesta **con forma**, y
 * sin ella el caso no se puede leer y así se informa.
 *
 * `galleta` a `null` es un caso del experimento y no un descuido: sirve para
 * saber si el endpoint mira la sesión siquiera, que es lo que decide si esta
 * sonda mide algo.
 */
export async function usarSesion(galleta, { intentos = 4 } = {}) {
  for (let intento = 1; intento <= intentos; intento += 1) {
    const { estado, cuerpo } = await postear(galleta, '/cita/cargaTiposAtencionMapa', {
      ...COMUNES,
      ...ZONA,
      codigoEntidad: 'SEPE',
    })

    if (cuerpo.trim()) return { estado, intentos: intento, ...(await leer(galleta, cuerpo)) }
    if (intento < intentos) await esperar(PAUSA_MS)
  }

  // Cuatro cuerpos vacíos seguidos. No es «la sesión no vale»: es que no se ha
  // podido preguntar, y decirlo de otra forma sería justo la confusión que
  // este proyecto tiene prohibida.
  return { estado: 200, intentos, lectura: 'sin-respuesta', canales: 0, oficinas: 0 }
}

/**
 * Qué ha contestado el SEPE. El listón de «ha contestado» es que **haya
 * canales**, y no que haya oficinas: en la captura que hay grabada en el
 * repositorio la primera llamada ya trae la lista de oficinas vacía, y las
 * oficinas salen por la segunda puerta. Pedir oficinas aquí haría fallar el
 * control por un motivo que no tiene nada que ver con la sesión.
 */
async function leer(galleta, cuerpo) {
  let json
  try {
    json = JSON.parse(cuerpo)
  } catch {
    return { lectura: 'html', canales: 0, oficinas: 0, primerosBytes: cuerpo.slice(0, 120) }
  }

  const canales = json.listTipoAtencion ?? []
  if (json.listaOficina?.length) {
    return { lectura: 'json', canales: canales.length, oficinas: json.listaOficina.length }
  }
  if (!canales.length) return { lectura: 'json', canales: 0, oficinas: 0 }

  await esperar(PAUSA_MS)
  const segunda = await postear(galleta, '/cita/cargaOficinasMapa', {
    ...COMUNES,
    ...ZONA,
    codigoEntidad: '',
    idTipoAtencion: canales[0].idTipoAtencion,
    idTipoAtencionTR: 0,
  })

  let oficinas = 0
  try {
    oficinas = JSON.parse(segunda.cuerpo).listaOficina?.length ?? 0
  } catch {
    /* la segunda puerta también puede venir vacía; el canal ya dice que contestó */
  }

  return { lectura: 'json', canales: canales.length, oficinas }
}
