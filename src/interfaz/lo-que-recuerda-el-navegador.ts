import { avisoDe, soloDigitos } from './codigo-postal'

/**
 * Las dos únicas cosas que esta web recuerda, y las dos viven en el navegador
 * de quien pregunta: el último código postal usado y el de la búsqueda que
 * está mirando.
 *
 * Ninguna de las dos toca un servidor nuestro. Es lo que permite que la
 * portada diga que no guardamos ningún dato sin tener que matizarlo con letra
 * pequeña.
 */

const CLAVE = 'ultimo-codigo-postal'

/** El nombre del parámetro dentro del fragmento: `#cp=08401`. */
const PARAMETRO = 'cp'

/**
 * La búsqueda va en el **fragmento** de la URL y no en la cadena de consulta.
 *
 * No es cosmético y es lo que hace compatibles dos cosas que parecían reñidas:
 * que una búsqueda se pueda compartir y volver a abrir, y que el código postal
 * no aparezca en ninguna URL que el alojamiento registre. El fragmento no se
 * manda en la petición —ni siquiera al abrir el enlace por primera vez—, así
 * que un `#cp=08401` compartido no deja escrito en el registro de Vercel de
 * dónde es quien lo abre. Un `?cp=08401` sí lo dejaría.
 */
export function codigoPostalDeLaDireccion(): string {
  const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const codigoPostal = soloDigitos(fragmento.get(PARAMETRO) ?? '')
  // Lo que venga en un enlace se comprueba como si lo hubiera tecleado
  // alguien: un fragmento lo escribe cualquiera.
  return avisoDe(codigoPostal) === null ? codigoPostal : ''
}

/**
 * Deja la búsqueda escrita en la dirección, sin apuntarla en el historial.
 *
 * `replaceState` y no `pushState` porque cada consulta no es un sitio nuevo
 * donde se ha estado: con `pushState`, volver atrás desde la lista recorrería
 * una a una todas las búsquedas de la sesión en vez de salir de la web.
 */
export function ponerEnLaDireccion(codigoPostal: string): void {
  window.history.replaceState(null, '', `#${PARAMETRO}=${codigoPostal}`)
}

/**
 * El último código postal usado, para proponerlo la próxima vez.
 *
 * Si el navegador no deja guardar —modo privado, almacenamiento bloqueado— no
 * pasa nada: se propone el campo vacío. Que esto falle no puede llevarse por
 * delante la pantalla, porque es una comodidad y no la función.
 */
export function ultimoCodigoPostal(): string {
  try {
    return soloDigitos(window.localStorage.getItem(CLAVE) ?? '')
  } catch {
    return ''
  }
}

export function recordarCodigoPostal(codigoPostal: string): void {
  try {
    window.localStorage.setItem(CLAVE, codigoPostal)
  } catch {
    // Ver arriba: recordarlo es una comodidad.
  }
}
