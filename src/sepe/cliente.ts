import type { Fetch } from '@/nucleo/dependencias'
import { registro } from '@/nucleo/registro'
import type { Freno } from './freno'

const BASE = 'https://citaprevia-sede.sepe.gob.es/citapreviasepe'

/** La portada. Es donde el SEPE reparte la cookie de sesión. */
const PORTADA = `${BASE}/?origen=sepe&codidioma=es`

const AGENTE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0'

/** El SEPE lo manda en todas las llamadas del mapa. Verificado en las capturas. */
const ID_CLIENTE = 39

/**
 * Lo que cada llamada dice que espera. No es lo mismo en las dos, y no es un
 * detalle: en las capturas, la llamada del combo de subtrámites pide HTML y
 * las de JSON piden JSON. Se le manda al SEPE lo que él mismo se manda.
 */
const ACEPTA_JSON = 'application/json, text/javascript, */*; q=0.01'
const ACEPTA_HTML = 'text/html, */*; q=0.01'

/**
 * Cuántas veces se insiste ante una respuesta que no es JSON.
 *
 * Tres, y no más, porque cada intento cuesta una sesión nueva y dos pausas del
 * freno: insistir más solo alarga el frenazo y le mete al SEPE la carga que se
 * intenta evitar.
 */
const INTENTOS = 3

export type Parametros = Record<string, string | number>

/** El SEPE contestó 200 con el cuerpo vacío. Es información, no avería. */
export class SepeSinAgenda extends Error {
  constructor() {
    super('El SEPE ha contestado sin cuerpo.')
    this.name = 'SepeSinAgenda'
  }
}

/** Tres veces seguidas contestando algo que no se esperaba: está caído o saturado. */
export class SepeNoResponde extends Error {
  constructor() {
    super('El SEPE no ha contestado lo que se esperaba después de tres intentos.')
    this.name = 'SepeNoResponde'
  }
}

/** Una sesión viva con el SEPE: se abre, se usa y se tira. */
export interface SesionSepe {
  /** Un POST del que se espera JSON. Reintenta con sesión nueva si no lo es. */
  json<T>(ruta: string, parametros: Parametros): Promise<T>
  /**
   * Un POST del que se espera HTML. Reintenta con sesión nueva si el cuerpo no
   * lleva `senal` dentro.
   *
   * Hace falta una señal porque aquí no vale el truco del JSON: cuando el SEPE
   * se satura contesta una página de error, que también es HTML, y sin algo que
   * mirar dentro se colaría como respuesta buena. La señal es un trozo de la
   * plantilla del combo que se está pidiendo, y quien llama sabe cuál es.
   */
  html(ruta: string, parametros: Parametros, senal: string): Promise<string>
}

export interface ClienteSepe {
  /**
   * Abre una sesión con el SEPE, deja hacer, y la tira.
   *
   * La sesión no sobrevive a la invocación a propósito: en serverless cada
   * petición puede caer en una instancia distinta con otra IP de salida, y una
   * cookie guardada de una invocación anterior es una cookie que el SEPE puede
   * no reconocer. Abrirla cuesta una petición más; arrastrarla cuesta fallos
   * intermitentes imposibles de reproducir.
   */
  enUnaSesion<T>(trabajo: (sesion: SesionSepe) => Promise<T>): Promise<T>
}

export function crearClienteSepe(fetch: Fetch, freno: Freno): ClienteSepe {
  return {
    async enUnaSesion(trabajo) {
      return trabajo(crearSesion(fetch, freno))
    },
  }
}

interface Contestacion {
  ok: boolean
  cuerpo: string
}

function crearSesion(fetch: Fetch, freno: Freno): SesionSepe {
  /** La cookie de sesión, cuando el SEPE la ha dado. `null` = aún no hay sesión. */
  let galleta: string | null = null
  let abierta = false

  async function abrir(): Promise<void> {
    await freno.fichar()
    const respuesta = await fetch(PORTADA, {
      headers: { 'user-agent': AGENTE, 'accept-language': 'es-ES,es;q=0.9' },
    })
    galleta = jsessionidDe(respuesta)
    abierta = true
  }

  async function postear(ruta: string, parametros: Parametros, acepta: string): Promise<Contestacion> {
    if (!abierta) await abrir()
    await freno.fichar()

    const respuesta = await fetch(`${BASE}${ruta}`, {
      method: 'POST',
      headers: {
        'user-agent': AGENTE,
        accept: acepta,
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest',
        origin: 'https://citaprevia-sede.sepe.gob.es',
        referer: PORTADA,
        'accept-language': 'es-ES,es;q=0.9',
        ...(galleta ? { cookie: galleta } : {}),
      },
      body: cuerpoDeFormulario({ idCliente: ID_CLIENTE, ...parametros }),
    })

    return { ok: respuesta.ok, cuerpo: await respuesta.text() }
  }

  /**
   * Postea e interpreta, insistiendo con una sesión nueva mientras la respuesta
   * no tenga la forma que tenía que tener.
   *
   * Que `interpretar` reviente es la señal de reintento, y por eso lo comparten
   * el JSON y el HTML: los dos endpoints se estropean igual —la sesión se queda
   * sorda y contesta una página—, y lo único que cambia es cómo se nota.
   */
  async function insistir<T>(
    ruta: string,
    parametros: Parametros,
    acepta: string,
    interpretar: (cuerpo: string) => T,
  ): Promise<T> {
    for (let intento = 1; ; intento += 1) {
      // Si el `fetch` falla —red caída, socket colgado— el error sale de
      // aquí tal cual. Convertirlo en `sepe-no-responde` taparía también el
      // error del `fetch` falso que avisa de que a un test le falta una
      // grabación, que es justo el aviso que no se puede perder.
      const { ok, cuerpo } = await postear(ruta, parametros, acepta)

      if (ok && !cuerpo.trim()) {
        // El vacío es lo que endurece el ritmo: tres seguidos y la pausa se
        // dobla. Se anota aquí porque este es el único sitio que ve las
        // respuestas del SEPE una por una. Una página de error no cuenta: eso
        // es la sesión sorda, y se arregla renovándola, no frenando.
        await freno.anotar('vacia')
        throw new SepeSinAgenda()
      }

      if (ok) {
        const salida = interpretarSiSePuede(() => interpretar(cuerpo))
        if (salida.bien) {
          await freno.anotar('buena')
          return salida.valor
        }
        // Si no, cae al reintento de abajo.
      }

      // Una página de error donde tenía que ir la respuesta: la sesión se ha
      // quedado sorda. Medido a mano: el mismo trámite que falla con la sesión
      // vieja contesta bien con una recién hecha unos segundos después.
      abierta = false
      galleta = null

      if (intento >= INTENTOS) {
        registro.aviso('el SEPE no contesta lo que se espera después de tres intentos: se da por caído')
        throw new SepeNoResponde()
      }
      registro.aviso('el SEPE ha contestado algo que no se esperaba: se reintenta con una sesión nueva')
    }
  }

  return {
    json<T>(ruta: string, parametros: Parametros): Promise<T> {
      return insistir(ruta, parametros, ACEPTA_JSON, (cuerpo) => JSON.parse(cuerpo) as T)
    },

    html(ruta: string, parametros: Parametros, senal: string): Promise<string> {
      return insistir(ruta, parametros, ACEPTA_HTML, (cuerpo) => {
        if (!cuerpo.includes(senal)) throw new Error('no es la respuesta que se esperaba')
        return cuerpo
      })
    },
  }
}

/**
 * Interpreta y dice si ha podido, en vez de dejar volar el error.
 *
 * Que `interpretar` reviente es la señal de reintento y no un fallo que
 * contar, pero el `try` no puede envolver también lo que viene después: una
 * anotación al freno que fallara se leería como "la respuesta no valía" y
 * costaría una sesión nueva y dos pausas por nada.
 */
function interpretarSiSePuede<T>(interpretar: () => T): { bien: true; valor: T } | { bien: false } {
  try {
    return { bien: true, valor: interpretar() }
  } catch {
    return { bien: false }
  }
}

function cuerpoDeFormulario(parametros: Parametros): URLSearchParams {
  return new URLSearchParams(Object.entries(parametros).map(([clave, valor]) => [clave, String(valor)]))
}

function jsessionidDe(respuesta: Response): string | null {
  for (const galleta of respuesta.headers.getSetCookie()) {
    const par = galleta.split(';')[0].trim()
    if (par.startsWith('JSESSIONID=')) return par
  }
  return null
}
