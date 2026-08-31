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

/**
 * Cuánto se espera a cada sitio. Cortos a propósito: la invocación desplegada
 * encadena varias de estas y tiene que caber en el techo del alojamiento (60 s
 * en el plan gratuito de Vercel). Un tiempo de espera generoso aquí se
 * convierte allí en una invocación cortada por la plataforma, que es un fallo
 * que se leería como «el SEPE no contesta» sin serlo.
 */
const ESPERA_SEPE_MS = 12000
const ESPERA_IP_MS = 4000

/**
 * De dónde ha salido esta petición, visto desde fuera.
 *
 * Devuelve `null` si no se ha podido saber, y **no** una cadena: quien compara
 * dos IPs tiene que poder distinguir «salieron por sitios distintos» de «no se
 * sabe por dónde salieron», y un `'desconocida'` comparado con una IP de
 * verdad da distinto, que es justo la conclusión falsa que este experimento no
 * se puede permitir.
 */
export async function ipDeSalida() {
  try {
    const respuesta = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(ESPERA_IP_MS),
    })
    return (await respuesta.json()).ip ?? null
  } catch {
    return null
  }
}

/** Primera mitad: pedir la portada y quedarse con la cookie que reparte. */
export async function abrirSesion() {
  const respuesta = await fetch(PORTADA, {
    headers: { 'user-agent': AGENTE, 'accept-language': 'es-ES,es;q=0.9' },
    signal: AbortSignal.timeout(ESPERA_SEPE_MS),
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
    signal: AbortSignal.timeout(ESPERA_SEPE_MS),
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
  let ultimoEstado = 0

  for (let intento = 1; intento <= intentos; intento += 1) {
    const { estado, cuerpo } = await postear(galleta, '/cita/cargaTiposAtencionMapa', {
      ...COMUNES,
      ...ZONA,
      codigoEntidad: 'SEPE',
    })
    ultimoEstado = estado

    const salida = leer(cuerpo)

    // Se reintenta ante el cuerpo vacío **y ante el HTML**, y esto último no
    // es un detalle: cuando el SEPE se satura contesta una página de error, y
    // darla por «no ha contestado» a la primera bajaría todas las tasas por
    // igual salvo la del control, que es el único caso que se repite con
    // sesión nueva. O sea, sesgaría el experimento justo hacia la conclusión
    // que se está tratando de comprobar. `src/sepe/cliente.ts` reintenta ante
    // las dos cosas por la misma razón.
    // El listón es el mismo que usan los dos conductores para contar un éxito
    // —JSON *con* canales—, y tiene que serlo: si aquí se diera por buena una
    // respuesta que allí se cuenta como fallo, esa diferencia se colaría en
    // las tasas sin que nadie la viera.
    if (salida.lectura === 'json' && salida.canales > 0) {
      return { estado, intentos: intento, ...salida }
    }
    if (intento < intentos) await esperar(PAUSA_MS)
  }

  // Se acabaron los intentos sin una sola respuesta con forma. No es «la sesión
  // no vale»: es que no se ha podido preguntar, y decirlo de otra forma sería
  // justo la confusión que este proyecto tiene prohibida. El estado que se
  // devuelve es el último de verdad —un 403 o un 503 no se pueden confundir
  // con un 200 vacío, porque «nos están bloqueando» es uno de los desenlaces
  // que este experimento podría estar midiendo—.
  return { estado: ultimoEstado, intentos, lectura: 'sin-respuesta', canales: 0 }
}

/**
 * Qué ha contestado el SEPE, en las tres formas que se distinguen: JSON con
 * forma, página de saturación, o nada.
 *
 * El listón de «ha contestado» es que **haya canales**, y no que haya
 * oficinas: en la captura grabada en el repositorio esta primera llamada ya
 * trae `listaOficina` vacía, y las oficinas salen por `cargaOficinasMapa`.
 * Pedir oficinas aquí haría fallar el control por un motivo que no tiene nada
 * que ver con la sesión, que es lo único que se está midiendo.
 *
 * Y por eso tampoco se llama a esa segunda puerta: no añadiría nada a la
 * respuesta y le costaría a la invocación desplegada una pausa del freno y
 * otra petición, que es lo que la acercaría al techo del alojamiento.
 */
function leer(cuerpo) {
  if (!cuerpo.trim()) return { lectura: 'vacio', canales: 0 }

  try {
    return { lectura: 'json', canales: (JSON.parse(cuerpo).listTipoAtencion ?? []).length }
  } catch {
    return { lectura: 'html', canales: 0, primerosBytes: cuerpo.slice(0, 120) }
  }
}
