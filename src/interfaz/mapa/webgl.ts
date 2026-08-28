/**
 * Si este navegador puede pintar un mapa.
 *
 * MapLibre necesita WebGL, y hay quien no lo tiene: navegadores viejos,
 * máquinas con la aceleración desactivada, modos de ahorro, y el propio jsdom
 * de los tests. Preguntarlo **antes** de traerse la librería tiene dos efectos
 * que valen la pena: quien no puede usar el mapa no se descarga casi un mega
 * de JavaScript para nada, y quien mira desde un test ve exactamente lo que ve
 * esa persona, que es la lista entera.
 */
export function sePuedePintarUnMapa(): boolean {
  // Se mira primero el constructor: preguntarle por el contexto a un lienzo en
  // un entorno sin WebGL levanta un error en algunas implementaciones.
  if (typeof WebGL2RenderingContext === 'undefined') return false

  try {
    return document.createElement('canvas').getContext('webgl2') !== null
  } catch {
    return false
  }
}
