/**
 * Desde qué móvil se está mirando, y si esto ya está en su pantalla de inicio.
 *
 * Se tocan las propiedades del `navigator` una a una con `defineProperty` y no
 * se sustituye el objeto entero: de él cuelgan también el idioma, el
 * almacenamiento y el `onLine`. `preparar.ts` las borra después de cada test.
 */

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

/** El iPad de hoy, que dice ser un Mac y solo se delata por la pantalla táctil. */
const IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

function elNavegadorDice(agente: string, puntosTactiles: number): void {
  Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: agente })
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: puntosTactiles,
  })
}

export function unIphone(): void {
  elNavegadorDice(IPHONE, 5)
}

export function unIpad(): void {
  elNavegadorDice(IPAD, 5)
}

export function unAndroid(): void {
  elNavegadorDice(ANDROID, 5)
}

export function unOrdenador(): void {
  elNavegadorDice(IPAD.replace('Version/17.5 ', ''), 0)
}

/** Ya añadida a la pantalla de inicio: abierta desde el icono y sin barra. */
export function yaEnLaPantallaDeInicio(): void {
  Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true })
}
