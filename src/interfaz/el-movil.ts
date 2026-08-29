/**
 * Desde qué móvil se está mirando, y si esto ya está en su pantalla de inicio.
 *
 * Existe por una diferencia que no es nuestra y que no se puede tapar: en
 * Android el navegador ofrece él solo instalar la web, y en el iPhone **no hay
 * botón**. Ahí hay que decirlo a mano —Compartir, y luego «Añadir a pantalla de
 * inicio»— o quien mira desde un iPhone no se entera de que esto se puede tener
 * como una aplicación.
 *
 * Mirar el `userAgent` es lo que es: adivinar. Se hace igual porque la
 * alternativa —enseñarle a todo el mundo unos pasos que solo existen en iOS— es
 * peor, y porque equivocarse aquí no rompe nada: lo que sale es un párrafo de
 * más o de menos.
 */

/**
 * Si esto es un cacharro de Apple con pantalla táctil.
 *
 * El iPad desde iPadOS 13 dice ser un Mac, palabra por palabra: lo único que lo
 * distingue de un Mac de verdad es que tiene pantalla táctil. Por eso los
 * puntos táctiles entran en la cuenta y no basta con leer el `userAgent`.
 */
export function esUnIphone(agente: string, puntosTactiles: number): boolean {
  if (/iPhone|iPod|iPad/.test(agente)) return true
  return /Macintosh/.test(agente) && puntosTactiles > 1
}

/**
 * Si ya se abrió desde el icono.
 *
 * Se preguntan las dos cosas porque cada navegador contesta a una: Safari en
 * iOS lo dice con `navigator.standalone`, que es suyo y de nadie más, y el
 * resto lo dicen con la media query.
 */
export function yaEstaEnLaPantallaDeInicio(): boolean {
  const comoAplicacion = window.matchMedia('(display-mode: standalone)').matches
  return comoAplicacion || (window.navigator as { standalone?: boolean }).standalone === true
}

/** Si hay que explicar los pasos: solo en Apple, y solo a quien no la tenga ya. */
export function hayQueExplicarComoSeAnade(): boolean {
  const { userAgent, maxTouchPoints } = window.navigator
  return esUnIphone(userAgent, maxTouchPoints) && !yaEstaEnLaPantallaDeInicio()
}
