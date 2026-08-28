import type { OficinaConSuTramite } from './lo-que-va-llegando'

/**
 * Lo que quien mira la lista decide **sin volver a preguntarle al SEPE**.
 *
 * Está todo aquí y sin nada de React dentro a propósito: son funciones puras
 * sobre la lista que ya ha llegado, y por eso los filtros son instantáneos y no
 * cuestan ni una petición. Lo caro —salir al SEPE— ya se ha pagado.
 *
 * Y por eso también se pueden probar sin montar la pantalla, que es donde se
 * comprueba lo que de verdad importa: que «por la tarde» deje fuera lo que
 * tiene que dejar y no una hora de más.
 */

/**
 * La franja del **primer hueco de cada oficina**, y no su agenda.
 *
 * La distinción no es un matiz: el desglose de días y horas del SEPE
 * (`calendarioServicio`) exige el DNI, y esta fase no lo pide. Lo único que hay
 * es la hora del primer hueco, así que es lo único que se puede filtrar y lo
 * único que la pantalla puede decir que filtra.
 */
export type Franja = 'cualquiera' | 'manana' | 'tarde'

/** Para cuándo se busca hueco. */
export type Cuando = 'cualquiera' | 'hoy' | 'semana' | 'mes'

export type Orden = 'distancia' | 'antes'

export interface Filtros {
  /** Radio máximo en kilómetros. En `KM_MAXIMO` no filtra: es «sin límite». */
  km: number
  franja: Franja
  cuando: Cuando
  orden: Orden
}

/**
 * El radio baja hasta un kilómetro porque quien no tiene coche no busca «cerca»
 * sino «andando»: a cinco kilómetros de radio ya hay hora y media de paseo.
 */
export const KM_MINIMO = 1

/**
 * El tope del control **no es un radio de cien kilómetros**: es no filtrar. Si
 * fuera un radio, una zona rural cuya oficina más cercana está a ciento veinte
 * se quedaría sin lista y sin saber por qué.
 */
export const KM_MAXIMO = 100

export const SIN_FILTROS: Filtros = {
  km: KM_MAXIMO,
  franja: 'cualquiera',
  cuando: 'cualquiera',
  orden: 'distancia',
}

/** Cada uno de los tres que pueden dejar fuera a una oficina. El orden no. */
export type Culpable = 'distancia' | 'franja' | 'fecha'

const CULPABLES: Culpable[] = ['distancia', 'franja', 'fecha']

/**
 * Cómo se nombra cada filtro dentro de una frase, para poder decir cuál está
 * tapando la lista sin que quien lee tenga que adivinar a qué control mirar.
 */
export function nombreDelFiltro(culpable: Culpable): string {
  switch (culpable) {
    case 'distancia':
      return 'distancia'
    case 'franja':
      return 'franja horaria'
    case 'fecha':
      return 'fecha'
  }
}

/**
 * Las dos de la tarde.
 *
 * Es donde parte la jornada de las oficinas del SEPE —el horario que mandan es
 * de mañana casi siempre— y es lo que quien pregunta entiende por «tarde». A
 * las 14:00 en punto ya es tarde: si fuera mañana, el filtro de mañana
 * enseñaría una hora a la que media plantilla ya ha cerrado.
 */
const EMPIEZA_LA_TARDE = 14

/** Cuántos días cubre cada opción de fecha, contando hoy. */
const DIAS = { hoy: 1, semana: 7, mes: 30 } as const

export function aplicando(
  oficinas: OficinaConSuTramite[],
  filtros: Filtros,
  /** Desde cuándo se cuentan «hoy», «esta semana» y «este mes». */
  referencia: number,
): OficinaConSuTramite[] {
  const dentro = oficinas.filter((oficina) => CULPABLES.every((cual) => pasa(oficina, filtros, cual, referencia)))
  return ordenando(dentro, filtros.orden)
}

/** Cuántas se ven y cuántas hay: el contador que dice si uno se ha pasado. */
export function contando(
  oficinas: OficinaConSuTramite[],
  filtros: Filtros,
  referencia: number,
): { visibles: number; total: number } {
  return { visibles: aplicando(oficinas, filtros, referencia).length, total: oficinas.length }
}

/**
 * Qué filtros están tapando la lista: los que, **quitados ellos solos**,
 * devolverían algún resultado.
 *
 * Devolver los que sirven de uno en uno y no «alguno de los puestos» es lo que
 * permite ofrecer quitarlo de un clic y que quitarlo funcione. Cuando harían
 * falta dos no se señala a ninguno: lo que arregla eso es el «quitar filtros»,
 * y prometer lo contrario sería dejar a alguien pulsando un botón que no le
 * devuelve nada.
 */
export function quienLasTapa(
  oficinas: OficinaConSuTramite[],
  filtros: Filtros,
  referencia: number,
): Culpable[] {
  // Sin oficinas no hay nada tapado: lo que pasa es que no ha llegado nada, y
  // eso ya lo cuenta el resumen de la búsqueda.
  if (oficinas.length === 0) return []
  if (aplicando(oficinas, filtros, referencia).length > 0) return []

  return CULPABLES.filter(
    (cual) => esta(filtros, cual) && aplicando(oficinas, quitando(filtros, cual), referencia).length > 0,
  )
}

/** Si hay algo puesto que esté dejando oficinas fuera. El orden no deja a nadie fuera. */
export function hayFiltros(filtros: Filtros): boolean {
  return CULPABLES.some((cual) => esta(filtros, cual))
}

/** Los mismos filtros sin ese. El orden elegido se respeta: no es un filtro. */
export function quitando(filtros: Filtros, culpable: Culpable): Filtros {
  switch (culpable) {
    case 'distancia':
      return { ...filtros, km: SIN_FILTROS.km }
    case 'franja':
      return { ...filtros, franja: SIN_FILTROS.franja }
    case 'fecha':
      return { ...filtros, cuando: SIN_FILTROS.cuando }
  }
}

/** Vuelta al resultado completo, conservando por qué se ordenaba. */
export function quitandoTodos(filtros: Filtros): Filtros {
  return { ...SIN_FILTROS, orden: filtros.orden }
}

function esta(filtros: Filtros, culpable: Culpable): boolean {
  switch (culpable) {
    case 'distancia':
      return filtros.km !== SIN_FILTROS.km
    case 'franja':
      return filtros.franja !== SIN_FILTROS.franja
    case 'fecha':
      return filtros.cuando !== SIN_FILTROS.cuando
  }
}

function pasa(
  oficina: OficinaConSuTramite,
  filtros: Filtros,
  culpable: Culpable,
  referencia: number,
): boolean {
  switch (culpable) {
    case 'distancia':
      return filtros.km === KM_MAXIMO || oficina.km <= filtros.km
    case 'franja':
      return filtros.franja === 'cualquiera' || enLaFranja(oficina.primerHueco, filtros.franja)
    case 'fecha':
      return filtros.cuando === 'cualquiera' || antesDe(oficina.primerHueco, limite(referencia, DIAS[filtros.cuando]))
  }
}

/**
 * Una oficina sin hueco no está ni por la mañana ni por la tarde, ni cae en
 * ninguna fecha: filtrar por cuándo atienden es preguntar por las que atienden.
 * Sin filtro sí sigue en la lista, porque «esta oficina existe y hoy no tiene
 * hora» es una respuesta.
 */
function enLaFranja(primerHueco: string | null, franja: Exclude<Franja, 'cualquiera'>): boolean {
  if (primerHueco === null) return false
  const hora = Number(primerHueco.slice(11, 13))
  return franja === 'manana' ? hora < EMPIEZA_LA_TARDE : hora >= EMPIEZA_LA_TARDE
}

function antesDe(primerHueco: string | null, ultimoDia: string): boolean {
  if (primerHueco === null) return false
  // Por día y no por hora: quien pide «esta semana» no está pidiendo «dentro de
  // ciento sesenta y ocho horas», y cortar a la hora exacta dejaría fuera un
  // hueco del último día por haber preguntado por la tarde.
  return primerHueco.slice(0, 10) <= ultimoDia
}

/**
 * El último día que entra, escrito como lo escribe el SEPE (`2026-08-23`).
 *
 * Las fechas se comparan como cadenas, igual que en el resto de la aplicación:
 * ese formato ordena escrito igual que en el tiempo, y así no hay que meter en
 * la comparación una zona horaria que las horas del SEPE no traen.
 */
function limite(referencia: number, dias: number): string {
  const fecha = new Date(referencia)
  fecha.setDate(fecha.getDate() + dias - 1)
  return enDia(fecha)
}

function enDia(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

function ordenando(oficinas: OficinaConSuTramite[], orden: Orden): OficinaConSuTramite[] {
  const ordenadas = [...oficinas]
  if (orden === 'distancia') return ordenadas.sort((una, otra) => una.km - otra.km)

  return ordenadas.sort((una, otra) => porElHueco(una, otra) || una.km - otra.km)
}

/**
 * Antes es mejor, y no tener hueco es lo último. Empatadas, manda la distancia:
 * dos oficinas con hora el mismo minuto se eligen por cuál cae más cerca.
 */
function porElHueco(una: OficinaConSuTramite, otra: OficinaConSuTramite): number {
  if (una.primerHueco === otra.primerHueco) return 0
  if (una.primerHueco === null) return 1
  if (otra.primerHueco === null) return -1
  return una.primerHueco < otra.primerHueco ? -1 : 1
}

/** El nombre de cada filtro dentro del fragmento de la dirección. */
const PARAMETROS = { km: 'km', franja: 'franja', cuando: 'cuando', orden: 'orden' } as const

const FRANJAS: Franja[] = ['cualquiera', 'manana', 'tarde']
const CUANDOS: Cuando[] = ['cualquiera', 'hoy', 'semana', 'mes']
const ORDENES: Orden[] = ['distancia', 'antes']

/**
 * Los filtros, escritos para la dirección de la página.
 *
 * Solo lo que se ha tocado: una dirección que arrastra los cuatro valores por
 * defecto es más larga de compartir y no dice nada más. Y sin `#` ni `?`
 * delante, porque quien la escribe es `lo-que-recuerda-el-navegador`, que ya
 * lleva el código postal ahí.
 */
export function enLaDireccion(filtros: Filtros): string {
  const partes = new URLSearchParams()
  if (filtros.km !== SIN_FILTROS.km) partes.set(PARAMETROS.km, String(filtros.km))
  if (filtros.franja !== SIN_FILTROS.franja) partes.set(PARAMETROS.franja, filtros.franja)
  if (filtros.cuando !== SIN_FILTROS.cuando) partes.set(PARAMETROS.cuando, filtros.cuando)
  if (filtros.orden !== SIN_FILTROS.orden) partes.set(PARAMETROS.orden, filtros.orden)
  return partes.toString()
}

/**
 * Lo que traiga la dirección, comprobado como si lo hubiera escrito alguien a
 * mano —porque un fragmento lo escribe cualquiera—. Lo que no vale no rompe
 * nada: se queda sin poner, que es lo mismo que no haber filtrado.
 */
export function deLaDireccion(fragmento: string): Filtros {
  const partes = new URLSearchParams(fragmento)
  return {
    km: kmDe(partes.get(PARAMETROS.km)),
    franja: unaDe(FRANJAS, partes.get(PARAMETROS.franja), SIN_FILTROS.franja),
    cuando: unaDe(CUANDOS, partes.get(PARAMETROS.cuando), SIN_FILTROS.cuando),
    orden: unaDe(ORDENES, partes.get(PARAMETROS.orden), SIN_FILTROS.orden),
  }
}

function kmDe(crudo: string | null): number {
  const km = Number(crudo)
  if (!Number.isInteger(km) || km < KM_MINIMO || km > KM_MAXIMO) return SIN_FILTROS.km
  return km
}

function unaDe<Valor extends string>(validos: Valor[], crudo: string | null, porDefecto: Valor): Valor {
  return validos.find((valido) => valido === crudo) ?? porDefecto
}
