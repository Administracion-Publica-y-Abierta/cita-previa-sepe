import { chromium, type Browser, type Locator, type Page } from 'playwright'
import { MAPA_DE_FONDO, VERDE_CON_HUECO } from '@/interfaz/mapa/estilo'
import type { AppDePrueba } from '../ayudantes/montar-app'
import { contestarLaBusqueda } from './el-sepe-grabado'

/**
 * El navegador de verdad, con la red cortada.
 *
 * Solo pasan dos cosas: lo que sirve la propia aplicación y el estilo del mapa
 * de fondo, que se contesta desde aquí. Cualquier otra petición se corta **y se
 * apunta**, y la prueba comprueba al final que la lista está vacía: es lo que
 * convierte «no habla con el SEPE real» en algo que se ve y no en algo que se
 * confía.
 */

/** Un ancho en el que caben las dos columnas, para que el mapa esté a la vista. */
const ESCRITORIO = { width: 1280, height: 900 }

/**
 * Un fondo liso en lugar de las teselas de OpenFreeMap.
 *
 * Los pines no salen del fondo: salen de las oficinas que ha traído la
 * búsqueda. Un fondo sin nada dentro deja además el color de los pines como lo
 * único que hay en la imagen, que es lo que se cuenta.
 */
const FONDO_LISO = {
  version: 8,
  name: 'fondo de prueba',
  sources: {},
  layers: [{ id: 'fondo', type: 'background', paint: { 'background-color': '#ffffff' } }],
}

export interface ElNavegador {
  pagina: Page
  /** Las peticiones que se han querido hacer fuera de esta máquina. Tiene que quedarse vacía. */
  fueraDeAqui: string[]
  cerrar(): Promise<void>
}

export async function abrirLaPortada(servidor: string, montaje: AppDePrueba): Promise<ElNavegador> {
  const navegador: Browser = await chromium.launch()
  const fueraDeAqui: string[] = []

  try {
    const contexto = await navegador.newContext({ viewport: ESCRITORIO })

    await contexto.route('**/*', async (ruta) => {
      const url = ruta.request().url()

      if (url.startsWith(servidor)) {
        if (new URL(url).pathname === '/api/busqueda') return contestarLaBusqueda(montaje, ruta)
        return ruta.continue()
      }

      if (url.startsWith(MAPA_DE_FONDO)) {
        return ruta.fulfill({ contentType: 'application/json', body: JSON.stringify(FONDO_LISO) })
      }

      fueraDeAqui.push(url)
      return ruta.abort()
    })

    const pagina = await contexto.newPage()
    await pagina.goto(servidor)

    return { pagina, fueraDeAqui, cerrar: () => navegador.close() }
  } catch (error) {
    // Si algo se tuerce de aquí en adelante, quien llama no recibe con qué
    // cerrar el navegador: nadie lo cerraría, y el fallo que acompaña a esto
    // —un servidor que levanta y no sirve— es justo aquel en el que menos
    // falta hace un Chromium vivo de más.
    await navegador.close()
    throw error
  }
}

/**
 * Cuántos píxeles de esa región son del verde de «con hueco».
 *
 * Es la única forma de mirar el mapa desde fuera: MapLibre dibuja los pines en
 * un lienzo de WebGL, así que no hay nodo que buscar ni texto que leer —lo que
 * hay es una imagen, y lo que se pregunta es lo mismo que ve quien mira la
 * pantalla: si ahí hay pines verdes, y cuántos menos hay al filtrar.
 *
 * La captura la saca el navegador de prueba y se vuelve a meter en la página
 * para leerla, porque un lienzo de WebGL no se puede leer desde dentro sin
 * pedirle a MapLibre que conserve el búfer, que es un ajuste de producción que
 * no se toca por un test.
 */
export async function pixelesConHueco(pagina: Page, region: Locator): Promise<number> {
  const captura = (await region.screenshot()).toString('base64')

  return pagina.evaluate(
    async ({ imagenEnBase64, color }) => {
      // Se descodifica con una imagen y no con `fetch`: en esta página está
      // puesta la lista blanca que corta todo lo que no sea la aplicación, y
      // una captura leída con `fetch` haría que la comprobación de aislamiento
      // dependiera de que Playwright no enrute las URL `data:`.
      const imagen = new Image()
      imagen.src = `data:image/png;base64,${imagenEnBase64}`
      await imagen.decode()

      const lienzo = new OffscreenCanvas(imagen.naturalWidth, imagen.naturalHeight)
      const pincel = lienzo.getContext('2d')
      if (!pincel) throw new Error('El navegador de prueba no ha dado un lienzo en el que mirar la captura.')

      pincel.drawImage(imagen, 0, 0)
      const { data } = pincel.getImageData(0, 0, imagen.naturalWidth, imagen.naturalHeight)

      // Con margen: el borde de cada círculo va suavizado, y exigir el color
      // exacto contaría solo el centro de cada pin.
      const cerca = (valor: number, esperado: number) => Math.abs(valor - esperado) <= 12

      let cuantos = 0
      for (let i = 0; i < data.length; i += 4) {
        if (cerca(data[i], color[0]) && cerca(data[i + 1], color[1]) && cerca(data[i + 2], color[2])) {
          cuantos += 1
        }
      }
      return cuantos
    },
    { imagenEnBase64: captura, color: colorEnRgb(VERDE_CON_HUECO) },
  )
}

/** `#15803d` → `[21, 128, 61]`, que es como llegan los píxeles. */
function colorEnRgb(hexadecimal: string): [number, number, number] {
  const numero = Number.parseInt(hexadecimal.slice(1), 16)
  return [(numero >> 16) & 255, (numero >> 8) & 255, numero & 255]
}

/**
 * Los pines del mapa cuando el dibujo ha parado de cambiar.
 *
 * Hace falta porque contar una sola vez es contar un fotograma cualquiera: la
 * geometría de los grupos la calcula el worker de MapLibre y llega cuando
 * llega, así que una captura puede pillar la mitad de los puntos pintados. Un
 * número que se repite dos veces seguidas ya es el dibujo terminado —entre dos
 * lecturas no se repite un fotograma a medias—, y es lo que se puede usar como
 * referencia contra la que comparar lo que dejan los filtros.
 */
export async function pinesAsentados(pagina: Page, region: Locator): Promise<number> {
  const limite = Date.now() + 30_000
  let anterior: number | null = null

  for (;;) {
    const cuantos = await pixelesConHueco(pagina, region)
    if (cuantos === anterior) return cuantos
    anterior = cuantos

    if (Date.now() > limite) {
      throw new Error(`El mapa no ha parado de cambiar en 30 s: el último recuento es ${cuantos}.`)
    }

    await pagina.waitForTimeout(100)
  }
}
