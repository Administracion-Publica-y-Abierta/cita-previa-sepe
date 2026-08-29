/**
 * Que el navegador crea que hay red, o que no la hay.
 *
 * Se toca `navigator.onLine` con `defineProperty` y no con `stubGlobal` porque
 * lo segundo sustituiría el `navigator` entero, y de ahí cuelga también lo que
 * usa el registro del service worker. `preparar.ts` lo devuelve a su sitio
 * después de cada test.
 */
export function sinCobertura(): void {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
}

export function conCobertura(): void {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
}
