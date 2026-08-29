/**
 * Si había red **al abrir**, que es la pregunta que hay que hacerse una sola
 * vez.
 *
 * De las dos respuestas de `onLine` solo una se puede creer: el navegador lo
 * pone en `false` cuando el sistema dice que no hay interfaz de red, y entonces
 * salir a preguntar es tirar el tiempo de quien mira. Que diga `true` no promete
 * nada —el wifi del bar que pide contraseña también es `true`—, así que aquí no
 * se usa para dar por buena una conexión, solo para saber cuándo no merece la
 * pena intentarlo.
 *
 * Y se lee una vez y se recuerda porque de esto depende **lo que se enseña**.
 * `onLine` cambia solo, sin que nadie toque nada: basta meterse en un túnel o
 * salir de él. Si se volviera a preguntar en cada pintado, la lista guardada que
 * hay delante desaparecería sola a mitad de leerla, y lo que quedaría es una
 * pantalla diciendo que busca sin que nadie esté buscando nada. Quien recupera
 * la cobertura tiene el botón de volver a comprobar, que es una decisión suya y
 * no un cambio de idea de la pantalla.
 */
let loQueHabia: boolean | null = null

export function habiaCoberturaAlAbrir(): boolean {
  if (loQueHabia === null) loQueHabia = window.navigator.onLine !== false
  return loQueHabia
}

/**
 * Para los tests, que en el mismo proceso abren la aplicación muchas veces: sin
 * esto, el primero que mirara dejaría su respuesta puesta para todos los demás.
 */
export function olvidarLaCobertura(): void {
  loQueHabia = null
}
