import type { Route } from 'playwright'
import { POST } from '@/app/api/busqueda/route'
import { dejarCorrer } from '../ayudantes/dejar-correr'
import { geocodificadorConoce } from '../ayudantes/geocodificador-falso'
import { montarApp, type AppDePrueba } from '../ayudantes/montar-app'
import { nivelesDelSepe, portadaDelSepe, subtramitesDelSepe } from '../ayudantes/sepe-falso'

/**
 * El SEPE que ve el navegador durante la prueba: el de las capturas.
 *
 * La ruta que contesta es el Route Handler de verdad, montado con `montarApp()`
 * —el `fetch` grabado y el reloj falso, el patrón de este repositorio— y lo
 * único que cambia es quién lo llama: aquí lo llama el navegador, por HTTP.
 *
 * Que la respuesta se arme aquí y no en el servidor de Next no es un atajo: es
 * lo que permite que **ninguna petición salga de esta máquina** y que la pasada
 * no cueste los cuarenta segundos de freno que costaría con el reloj de pared.
 * El freno los sigue midiendo; lo que no hace nadie es esperarlos.
 */

/** El código postal de la prueba: es el único de las capturas con agenda. */
export const CODIGO_POSTAL = '08402'

/** El trámite grabado con agenda: 46 oficinas, 37 con hueco. */
export const TRAMITE = { id: 631, nombre: 'Voy a salir al extranjero' }

/** El trámite de nivel 2 del que cuelga, tal como los agrupa el SEPE. */
const GRUPO = { id: 901, nombre: 'Estoy cobrando prestación/subsidio y ha cambiado mi situación' }

/** Los dos códigos postales de las capturas caen en Granollers. */
const GRANOLLERS = { municipio: 'Granollers', lat: 41.6083, lng: 2.2875 }

/**
 * La aplicación que atiende a esta prueba.
 *
 * El árbol de trámites va puesto a mano y las oficinas salen enteras de la
 * captura. Es la única forma de tenerlo todo grabado: el catálogo capturado es
 * el de 08401 y el trámite con agenda es el de 08402, así que descubrir el
 * árbol de verdad pediría al `fetch` falso siete respuestas que nadie grabó.
 */
export function elSepeGrabado(): AppDePrueba {
  return montarApp({
    respuestas: [
      portadaDelSepe(),
      geocodificadorConoce(CODIGO_POSTAL, GRANOLLERS),
      nivelesDelSepe(1, '', [{ id: 900, nombre: 'PRESTACIONES' }]),
      nivelesDelSepe(2, '900', [GRUPO]),
      subtramitesDelSepe(GRUPO.id, [TRAMITE]),
    ],
  })
}

/**
 * Contesta a `POST /api/busqueda` con lo que devuelve el Route Handler.
 *
 * La pasada se lee entera antes de contestar porque una respuesta interceptada
 * no se puede ir soltando a trozos. Se pierde la progresividad, que es un caso
 * real —una pasada corta cabe de sobra en una respuesta— y que ya se prueba
 * donde se puede mirar a mitad: en `pruebas/pasada.test.ts` y en los tests de
 * interfaz.
 */
export async function contestarLaBusqueda(montaje: AppDePrueba, ruta: Route): Promise<void> {
  const peticion = ruta.request()
  const respuesta = await POST(
    new Request(peticion.url(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: peticion.postData() ?? '{}',
    }),
  )

  const cuerpo = await dejarCorrer(montaje.reloj, respuesta.text())

  await ruta.fulfill({
    status: respuesta.status,
    contentType: respuesta.headers.get('content-type') ?? 'application/x-ndjson; charset=utf-8',
    body: cuerpo,
  })
}
