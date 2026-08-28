import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/busqueda/route'
import { deNdjson } from '@/nucleo/ndjson'
import type { EventoDeLaPasada } from '@/sepe/pasada'
import { dejarCorrer } from './ayudantes/dejar-correr'
import { geocodificadorNoConoce } from './ayudantes/geocodificador-falso'
import { loQueSeEscribe } from './ayudantes/lo-que-se-escribe'
import { montarApp } from './ayudantes/montar-app'
import { portadaDelSepe, sepeSaturado } from './ayudantes/sepe-falso'

/**
 * Las reglas de protección de datos no se prueban solo por comportamiento,
 * porque el comportamiento que hay que impedir es el que *todavía nadie ha
 * escrito*: la interpolación de mañana en un mensaje de aviso, la ruta
 * `/api/algo/[cp]` que alguien añada dentro de tres meses.
 *
 * Un dato personal escrito en el registro del alojamiento ya no se recupera, y
 * el fallo no da la cara: la aplicación funciona igual de bien. De ahí que
 * estas comprobaciones miren el código fuente y no la respuesta.
 */
const SRC = join(import.meta.dirname, '..', 'src')

describe('el código postal no puede acabar en ninguna URL nuestra', () => {
  it('ninguna ruta de /api contesta a GET', () => {
    // El alojamiento registra la URL entera de cada petición —la cadena de
    // consulta incluida— solo por existir. A un GET solo se le puede dar el
    // código postal por la URL, así que aquí las rutas van por el cuerpo de un
    // POST, que no se registra.
    //
    // Vale para el catálogo y para la búsqueda igual que para la localización:
    // todas comen código postal. El día que haga falta un GET que no lleve
    // datos de nadie, esta comprobación se estrecha; no se borra.
    const conGet = ficherosDe(join(SRC, 'app', 'api'))
      .filter((fichero) => /export\s+(async\s+)?function\s+GET\b/.test(readFileSync(fichero, 'utf8')))

    expect(conGet.map((fichero) => fichero.slice(SRC.length + 1))).toEqual([])
  })

  it('no hay ningún segmento dinámico bajo /api', () => {
    // Un `[segmento]` es exactamente eso: el dato en la ruta. Y el alojamiento
    // registra la ruta de cada petición sin que nadie se lo pida, así que
    // quedaría escrito de dónde es cada persona que mira si hay cita del paro.
    //
    // Si algún día hace falta un `/api/algo/[id]` que no lleve datos de nadie,
    // esta comprobación se estrecha; no se borra.
    expect(segmentosDinamicos(join(SRC, 'app', 'api'))).toEqual([])
  })
})

describe('los avisos de la aplicación no pueden llevar datos dentro', () => {
  it('solo `registro` escribe en la consola', () => {
    const culpables = ficherosDe(SRC)
      .filter((fichero) => fichero !== join(SRC, 'nucleo', 'registro.ts'))
      .filter((fichero) => /(^|[^.\w])console\s*\./.test(readFileSync(fichero, 'utf8')))

    expect(culpables.map((fichero) => fichero.slice(SRC.length + 1))).toEqual([])
  })

  it('todo lo que se avisa es un literal, sin nada interpolado', () => {
    // Interpolar es la única forma de que se cuele un dato, y se cuela sola: el
    // `message` de un `fetch` que falla arrastra la URL, y la URL del
    // geocodificador lleva el código postal dentro.
    const avisos = ficherosDe(SRC).flatMap((fichero) => [
      ...readFileSync(fichero, 'utf8').matchAll(/registro\.aviso\(([\s\S]*?)\)\s*$/gm),
    ])

    expect(avisos.length).toBeGreaterThan(0)
    for (const [, argumento] of avisos) {
      expect(argumento.trim()).toMatch(/^'[^'`$+]*'$/)
    }
  })
})

/**
 * Un código postal que no sale en ninguna grabación ni en ningún fixture: si
 * aparece escrito, ha llegado por la petición y por ningún otro sitio.
 */
const CODIGO_POSTAL = '28013'

describe('lo que se registra va limpio de lo que llegó en la petición', () => {
  it('una búsqueda con el geocodificador y el SEPE fallando no deja escrito el código postal', async () => {
    // Las dos reglas se prueban a la vez porque el camino es el mismo: los dos
    // servicios avisan al fallar, y los dos tienen el código postal a mano —el
    // geocodificador lo lleva dentro de la URL—. Es el camino con más avisos y
    // por tanto el que más ocasiones tiene de escribirlo.
    const montaje = montarApp({
      respuestas: [
        portadaDelSepe(),
        geocodificadorNoConoce(CODIGO_POSTAL),
        sepeSaturado('cargaComboNivelesTramitesCPEntidad'),
      ],
    })

    const escrito = await loQueSeEscribe(async () => {
      const respuesta = await POST(peticionDeBusqueda(CODIGO_POSTAL))
      await dejarCorrer(montaje.reloj, leerLaPasada(respuesta))
    })

    // Que hayan avisado los dos es parte de la comprobación: sin avisos esto
    // pasaría solo y sin proteger de nada.
    expect(escrito.length).toBeGreaterThanOrEqual(2)
    for (const linea of escrito) expect(linea).not.toContain(CODIGO_POSTAL)
  })
})

function peticionDeBusqueda(codigoPostal: string): Request {
  return new Request('http://localhost/api/busqueda', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cp: codigoPostal }),
  })
}

/** Se lee el streaming entero: los avisos salen mientras la pasada avanza. */
async function leerLaPasada(respuesta: Response): Promise<EventoDeLaPasada[]> {
  const eventos: EventoDeLaPasada[] = []
  if (!respuesta.body) return eventos

  for await (const evento of deNdjson<EventoDeLaPasada>(respuesta.body)) eventos.push(evento)
  return eventos
}

/** Los ficheros de código que cuelgan de un directorio, en cualquier nivel. */
function ficherosDe(raiz: string): string[] {
  return readdirSync(raiz, { withFileTypes: true }).flatMap((entrada) => {
    const camino = join(raiz, entrada.name)
    if (entrada.isDirectory()) return ficherosDe(camino)
    return /\.tsx?$/.test(entrada.name) ? [camino] : []
  })
}

/**
 * Los segmentos `[algo]` que cuelgan de un directorio, en cualquier nivel.
 *
 * Si el directorio no existe, revienta en vez de devolver la lista vacía: una
 * comprobación de seguridad que pasa sola cuando le mueven el sitio no protege
 * de nada y encima tranquiliza.
 */
function segmentosDinamicos(raiz: string): string[] {
  return readdirSync(raiz, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .flatMap((entrada) =>
      entrada.name.startsWith('[') ? [entrada.name] : segmentosDinamicos(join(raiz, entrada.name)),
    )
}
