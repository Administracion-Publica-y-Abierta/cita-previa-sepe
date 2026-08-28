import { avisoDe, soloDigitos } from './codigo-postal'
import { deLaDireccion, enLaDireccion, SIN_FILTROS, type Filtros } from './filtros'
import type { LoQueVaLlegando, TramiteResuelto } from './lo-que-va-llegando'

/**
 * Lo poco que esta web recuerda, y todo ello en el navegador de quien
 * pregunta: el último código postal usado, la búsqueda que está mirando —su
 * código postal, los trámites que haya marcado y cómo tenga filtrada la
 * lista— y el último resultado consultado, para poder enseñarlo cuando no hay
 * cobertura.
 *
 * Nada de esto toca un servidor nuestro. Es lo que permite que la portada diga
 * que no guardamos ningún dato sin tener que matizarlo con letra pequeña.
 */

const CLAVE = 'ultimo-codigo-postal'

/** Lo último que contestó el SEPE, tal como se estaba mirando. */
const RESULTADO = 'ultimo-resultado'

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
 * Lo que trae el enlace además del código postal: los trámites marcados y los
 * filtros de la lista. Así se comparte una búsqueda tal como se está mirando.
 *
 * Se lee una vez por fragmento y se recuerda, por lo mismo que `NINGUNO`: esto
 * son las instantáneas de dos `useSyncExternalStore`, y un valor nuevo en cada
 * lectura sería un repintado detrás de otro sin parar. Y se leen las dos de
 * una pasada porque salen del mismo sitio: dos memorias del mismo fragmento
 * serían dos formas de que una se quedara vieja.
 */
let ultimoFragmento: string | null = null
let ultimosTramites: number[] = NINGUNO
let ultimosFiltros: Filtros = SIN_FILTROS

function loQueTraeElEnlace(): void {
  const fragmento = window.location.hash
  if (fragmento === ultimoFragmento) return

  ultimoFragmento = fragmento
  const parametros = fragmento.replace(/^#/, '')
  ultimosTramites = losTramitesDe(parametros)
  ultimosFiltros = deLaDireccion(parametros)
}

export function tramitesDeLaDireccion(): number[] {
  loQueTraeElEnlace()
  return ultimosTramites
}

export function filtrosDeLaDireccion(): Filtros {
  loQueTraeElEnlace()
  return ultimosFiltros
}

/**
 * Lo que venga en el enlace se comprueba como si lo hubiera tecleado alguien:
 * un fragmento lo escribe cualquiera. Aquí solo se exige que sean números; que
 * además existan en la zona lo decide quien mira la cola, que es el único que
 * lo sabe.
 */
function losTramitesDe(parametros: string): number[] {
  const marcados = new URLSearchParams(parametros).get(TRAMITES)
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
 * una a una todas las búsquedas de la sesión en vez de salir de la web. Y
 * desde que hay filtros vale doble: mover el control de distancia dejaría
 * noventa y nueve paradas en el historial.
 */
export function ponerEnLaDireccion(
  codigoPostal: string,
  tramites: number[],
  filtros: Filtros,
): void {
  // Lo que no se ha tocado no se escribe. Sin marcar nada se enseñan todos, y
  // sin filtros no se filtra: un enlace que arrastrara los valores por defecto
  // diría lo mismo y sería ilegible.
  const marcados = tramites.length > 0 ? `&${TRAMITES}=${tramites.join(',')}` : ''
  const filtrado = enLaDireccion(filtros)
  window.history.replaceState(
    null,
    '',
    `#${PARAMETRO}=${codigoPostal}${marcados}${filtrado ? `&${filtrado}` : ''}`,
  )
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

/**
 * El último resultado consultado: la zona, lo que hubiera marcado y todo lo que
 * llegó.
 *
 * Se guarda entero y no un resumen porque lo que hay que poder enseñar sin red
 * es exactamente la pantalla que había: la lista, el mapa, y de cuándo es.
 */
export interface LoUltimoConsultado {
  codigoPostal: string
  elegidos: number[]
  estado: LoQueVaLlegando
}

/**
 * Lo guardado se lee una vez y se recuerda, por lo mismo que lo que trae el
 * enlace: esto es la instantánea de un `useSyncExternalStore`, y un objeto
 * nuevo en cada lectura sería un repintado detrás de otro sin parar.
 */
let yaSeLeyo = false
let loLeido: LoUltimoConsultado | null = null

export function recordarElResultado(ultimo: LoUltimoConsultado): void {
  // También aquí, y con el objeto que se acaba de guardar: si no, la siguiente
  // lectura devolvería lo de antes o algo recién construido.
  yaSeLeyo = true
  loLeido = ultimo

  try {
    window.localStorage.setItem(RESULTADO, JSON.stringify(ultimo))
  } catch {
    // Como el código postal: guardarlo es una comodidad y que el navegador no
    // deje —modo privado, cuota llena— no puede llevarse por delante nada.
  }
}

export function loUltimoConsultado(): LoUltimoConsultado | null {
  if (yaSeLeyo) return loLeido
  yaSeLeyo = true

  try {
    const guardado = window.localStorage.getItem(RESULTADO)
    if (guardado === null) return loLeido

    const leido: unknown = JSON.parse(guardado)
    if (esLoUltimoConsultado(leido)) loLeido = leido
  } catch {
    // Un almacenamiento bloqueado o algo escrito a mano que no cuadra: no hay
    // nada guardado, que es un caso normal y no una avería.
  }

  return loLeido
}

/**
 * Para los tests, que en el mismo proceso abren la aplicación muchas veces: sin
 * esto, el primero que leyera dejaría su respuesta puesta para todos los demás.
 */
export function olvidarLoLeido(): void {
  yaSeLeyo = false
  loLeido = null
}

/**
 * Lo guardado se comprueba como se comprueba un enlace: esto lo escribe
 * cualquiera desde las herramientas del navegador, y sobre todo lo escribió una
 * versión anterior de esta misma web, que es el caso que de verdad va a pasar.
 * Un formato viejo que no cuadre tiene que salir por aquí como «no hay nada
 * guardado», no reventar la pantalla de quien lo abre sin cobertura.
 *
 * Se mira la forma de lo que la pantalla recorre —la lista de trámites y las
 * oficinas de cada uno— y no cada campo de cada oficina: comprobar aquí el tipo
 * de todo sería escribir por segunda vez los tipos que ya están escritos, y
 * quedarían dos sitios donde acordarse de cambiarlos.
 */
function esLoUltimoConsultado(leido: unknown): leido is LoUltimoConsultado {
  if (typeof leido !== 'object' || leido === null) return false

  const { codigoPostal, elegidos, estado } = leido as Partial<LoUltimoConsultado>
  if (typeof codigoPostal !== 'string' || avisoDe(codigoPostal) !== null) return false
  if (!Array.isArray(elegidos) || elegidos.some((id) => typeof id !== 'number')) return false

  return esUnaBusqueda(estado)
}

function esUnaBusqueda(estado: unknown): estado is LoQueVaLlegando {
  if (typeof estado !== 'object' || estado === null) return false

  const { cola, resueltos } = estado as Partial<LoQueVaLlegando>
  if (!Array.isArray(cola) || !Array.isArray(resueltos)) return false

  // Sin ni un trámite resuelto no hay nada que enseñar, y enseñar una pantalla
  // vacía «de la última vez» es peor que no enseñar nada.
  return (
    resueltos.length > 0 &&
    resueltos.every((resuelto: TramiteResuelto) => Array.isArray(resuelto?.oficinas))
  )
}
