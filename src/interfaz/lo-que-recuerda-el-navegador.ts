import { avisoDe, soloDigitos } from './codigo-postal'

/**
 * Lo poco que esta web recuerda, y todo ello en el navegador de quien
 * pregunta: el último código postal usado, y la búsqueda que está mirando —su
 * código postal y los trámites que haya marcado—.
 *
 * Nada de esto toca un servidor nuestro. Es lo que permite que la portada diga
 * que no guardamos ningún dato sin tener que matizarlo con letra pequeña.
 */

const CLAVE = 'ultimo-codigo-postal'

/** El nombre del parámetro dentro del fragmento: `#cp=08401`. */
const PARAMETRO = 'cp'

/** Los trámites marcados, separados por comas: `#cp=08401&t=23,17`. */
const TRAMITES = 't'

/**
 * Ningún trámite marcado, y siempre el mismo array.
 *
 * `useSyncExternalStore` compara la instantánea con `Object.is`: una lista
 * vacía recién hecha en cada lectura sería distinta de la anterior y la
 * pantalla se repintaría sin parar. Se exporta por eso mismo, para que quien
 * la lea no se haga la suya.
 */
export const NINGUNO: number[] = []

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
 * Los trámites marcados que trae el enlace, para poder compartir una búsqueda
 * con sus trámites ya elegidos.
 *
 * Se recuerda lo leído mientras el fragmento no cambie por lo mismo que
 * `NINGUNO`: esto es la instantánea de un `useSyncExternalStore`, y una lista
 * nueva en cada lectura sería un repintado infinito.
 */
let ultimoFragmento: string | null = null
let ultimosTramites: number[] = NINGUNO

export function tramitesDeLaDireccion(): number[] {
  const fragmento = window.location.hash
  if (fragmento !== ultimoFragmento) {
    ultimoFragmento = fragmento
    ultimosTramites = losTramitesDe(fragmento)
  }
  return ultimosTramites
}

/**
 * Lo que venga en el enlace se comprueba como si lo hubiera tecleado alguien:
 * un fragmento lo escribe cualquiera. Aquí solo se exige que sean números; que
 * además existan en la zona lo decide quien mira la cola, que es el único que
 * lo sabe.
 */
function losTramitesDe(fragmento: string): number[] {
  const marcados = new URLSearchParams(fragmento.replace(/^#/, '')).get(TRAMITES)
  if (!marcados) return NINGUNO

  const ids = marcados
    .split(',')
    .map((id) => Number(id))
    .filter((id) => Number.isSafeInteger(id) && id > 0)

  return ids.length ? [...new Set(ids)] : NINGUNO
}

/**
 * Deja la búsqueda escrita en la dirección, sin apuntarla en el historial.
 *
 * `replaceState` y no `pushState` porque cada consulta no es un sitio nuevo
 * donde se ha estado: con `pushState`, volver atrás desde la lista recorrería
 * una a una todas las búsquedas de la sesión en vez de salir de la web.
 */
export function ponerEnLaDireccion(codigoPostal: string, tramites: number[]): void {
  // Sin marcar nada se enseñan todos, así que el parámetro sobra: un enlace
  // con la lista entera dentro diría lo mismo y sería ilegible.
  const marcados = tramites.length > 0 ? `&${TRAMITES}=${tramites.join(',')}` : ''
  window.history.replaceState(null, '', `#${PARAMETRO}=${codigoPostal}${marcados}`)
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
