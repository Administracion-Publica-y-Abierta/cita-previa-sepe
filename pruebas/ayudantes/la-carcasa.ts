import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createContext, runInContext } from 'node:vm'

/**
 * El service worker corriendo de verdad, con su caché y su red de mentira.
 *
 * La costura vuelve a ser la misma de siempre —el `fetch`— y se le añade la
 * única que el navegador pone aquí y en ningún otro sitio: el almacén de
 * cachés. Lo demás es el fichero tal cual, leído de `public/sw.js` y ejecutado:
 * lo que se prueba es el service worker que se despliega, no una copia suya.
 *
 * Hace falta porque esto no se puede probar por la pantalla. Lo que tiene que
 * pasar —que la aplicación abra sin red— pasa **antes** de que exista ninguna
 * pantalla, en un hilo aparte que jsdom no tiene.
 */

const FICHERO = join(import.meta.dirname, '..', '..', 'public', 'sw.js')

const ORIGEN = 'https://cita-previa-sepe.example'

/** Lo que la carcasa contesta cuando decide no meterse: contesta la red, como siempre. */
export const NO_SE_METE = null

interface Peticion {
  url: string
  method: string
  mode: string
}

/** Una petición se guarda por su URL, que es lo único que la distingue aquí. */
function clave(peticion: Peticion | string): string {
  return new URL(typeof peticion === 'string' ? peticion : peticion.url, ORIGEN).href
}

class Cajon {
  private readonly contenido = new Map<string, Response>()

  constructor(private readonly red: (peticion: Peticion | string) => Promise<Response>) {}

  /** Guardar algo pidiéndolo, que es como el service worker guarda la portada. */
  async add(peticion: Peticion | string): Promise<void> {
    const respuesta = await this.red(peticion)
    if (!respuesta.ok) throw new TypeError('no se ha podido guardar')
    await this.put(peticion, respuesta)
  }

  put(peticion: Peticion | string, respuesta: Response): Promise<void> {
    this.contenido.set(clave(peticion), respuesta)
    return Promise.resolve()
  }

  match(peticion: Peticion | string): Promise<Response | undefined> {
    return Promise.resolve(this.contenido.get(clave(peticion))?.clone())
  }

  get guardado(): string[] {
    return [...this.contenido.keys()]
  }
}

export interface LaCarcasa {
  /** El navegador la instala: es cuando se guarda lo imprescindible. */
  instalar(): Promise<void>
  /** Y la activa, que es cuando se limpia lo de la versión anterior. */
  activar(): Promise<void>
  /**
   * Una petición del navegador. Devuelve lo que la carcasa conteste, o
   * `NO_SE_METE` si la deja pasar a la red sin tocarla.
   */
  pedir(
    url: string,
    opciones?: { metodo?: string; modo?: 'navigate' | 'no-cors' },
  ): Promise<Response | null>
  /** Lo que la red contesta a esa dirección a partir de ahora. */
  contesta(url: string, cuerpo: string): void
  /** Se acabó la cobertura: la red deja de contestar, como en un túnel. */
  sinRed(): void
  /** Las peticiones que han salido de verdad a la red. */
  aLaRed: string[]
  /** Cómo se llaman las cachés que hay ahora mismo. */
  cajones(): string[]
  /** Lo guardado en una caché, por su nombre. */
  loGuardadoEn(nombre: string): string[]
}

export function montarLaCarcasa(contestaciones: Record<string, string> = { '/': 'la portada' }): LaCarcasa {
  const paginas = new Map(Object.entries(contestaciones))
  const cajones = new Map<string, Cajon>()
  const aLaRed: string[] = []
  let hayRed = true

  function red(peticion: Peticion | string): Promise<Response> {
    const camino = new URL(clave(peticion)).pathname
    aLaRed.push(camino)

    // Sin red el `fetch` del navegador no contesta con un estado: revienta.
    if (!hayRed) return Promise.reject(new TypeError('Failed to fetch'))

    const cuerpo = paginas.get(camino)
    if (cuerpo === undefined) return Promise.resolve(new Response('no está', { status: 404 }))
    return Promise.resolve(new Response(cuerpo, { status: 200 }))
  }

  const almacen = {
    open(nombre: string): Promise<Cajon> {
      const cajon = cajones.get(nombre) ?? new Cajon(red)
      cajones.set(nombre, cajon)
      return Promise.resolve(cajon)
    },
    keys: (): Promise<string[]> => Promise.resolve([...cajones.keys()]),
    delete: (nombre: string): Promise<boolean> => Promise.resolve(cajones.delete(nombre)),
    async match(peticion: Peticion | string): Promise<Response | undefined> {
      for (const cajon of cajones.values()) {
        const guardada = await cajon.match(peticion)
        if (guardada) return guardada
      }
      return undefined
    },
  }

  const oyentes = new Map<string, (evento: unknown) => void>()

  const yo = {
    location: { origin: ORIGEN },
    addEventListener: (tipo: string, oyente: (evento: unknown) => void) => oyentes.set(tipo, oyente),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  }

  runInContext(
    readFileSync(FICHERO, 'utf8'),
    createContext({ self: yo, caches: almacen, fetch: red, Response, URL }),
  )

  async function lanzar(tipo: string): Promise<void> {
    const esperas: unknown[] = []
    oyentes.get(tipo)?.({ waitUntil: (espera: unknown) => esperas.push(espera) })
    await Promise.all(esperas)
  }

  return {
    instalar: () => lanzar('install'),
    activar: () => lanzar('activate'),
    async pedir(url, { metodo = 'GET', modo = 'navigate' } = {}) {
      let contestacion: Promise<Response> | null = null
      oyentes.get('fetch')?.({
        request: { url: clave(url), method: metodo, mode: modo },
        respondWith: (respuesta: Promise<Response>) => {
          contestacion = respuesta
        },
        waitUntil: () => {},
      })

      return contestacion === null ? NO_SE_METE : await contestacion
    },
    contesta: (url, cuerpo) => paginas.set(url, cuerpo),
    sinRed: () => {
      hayRed = false
    },
    aLaRed,
    cajones: () => [...cajones.keys()],
    loGuardadoEn: (nombre) => cajones.get(nombre)?.guardado ?? [],
  }
}
