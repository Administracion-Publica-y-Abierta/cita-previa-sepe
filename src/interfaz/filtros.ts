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
 *
 * Los textos de las opciones viven aquí y no en el componente por lo mismo que
 * los de `resumen.ts`: son decisiones de idioma y de honradez —«(7 días)» va
 * escrito en la opción a propósito—, no de maquetación.
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

/** Para cuándo se busca hueco. También del primero, no de la agenda. */
export type Cuando = 'cualquiera' | 'hoy' | 'semana' | 'mes'

export type Orden = 'distancia' | 'antes'

export interface Filtros {
  /** Radio máximo en kilómetros. En `KM_MAXIMO` no filtra: es «sin límite». */
  km: number
  franja: Franja
  cuando: Cuando
  orden: Orden
}

/** Una opción de un grupo, con lo que se lee en su control. */
export interface Opcion<Valor extends string> {
  valor: Valor
  texto: string
}

export const FRANJAS: Opcion<Franja>[] = [
  { valor: 'cualquiera', texto: 'Cualquier hora' },
  { valor: 'manana', texto: 'Por la mañana' },
  { valor: 'tarde', texto: 'Por la tarde' },
]

/**
 * Los días van escritos en la propia opción —«(7 días)»— y no solo «esta
 * semana». Una semana natural que acabe mañana convertiría el filtro en algo
 * que casi nunca deja nada, y quien lo lee no tendría cómo saber por qué.
 */
export const CUANDOS: Opcion<Cuando>[] = [
  { valor: 'cualquiera', texto: 'Cualquier fecha' },
  { valor: 'hoy', texto: 'Hoy' },
  { valor: 'semana', texto: 'Esta semana (7 días)' },
  { valor: 'mes', texto: 'Este mes (30 días)' },
]

export const ORDENES: Opcion<Orden>[] = [
  { valor: 'distancia', texto: 'Distancia' },
  { valor: 'antes', texto: 'Lo antes posible' },
]

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

/**
 * Cada uno de los tres que pueden dejar fuera a una oficina. El orden no es uno
 * de ellos: cambia por dónde se empieza a leer, no quién sale en la lista.
 *
 * En un orden fijo y escrito, porque es el orden en que se nombran cuando hay
 * que decir cuáles están tapando la lista.
 */
const CUALES = ['distancia', 'franja', 'fecha'] as const

export type Filtro = (typeof CUALES)[number]

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

/**
 * Todo lo que hay que saber de un filtro, junto: cómo se llama dentro de una
 * frase, si está puesto, cómo se quita y a quién deja pasar.
 *
 * En una sola tabla y no en cuatro `switch` sobre lo mismo porque lo que se
 * añade el día que haya un cuarto filtro es una entrada, no cuatro ramas
 * repartidas por el fichero.
 */
const FILTROS: Record<
  Filtro,
  {
    nombre: string
    puesto: (filtros: Filtros) => boolean
    quitar: (filtros: Filtros) => Filtros
    pasa: (oficina: OficinaConSuTramite, filtros: Filtros, referencia: number) => boolean
  }
> = {
  distancia: {
    nombre: 'distancia',
    puesto: (filtros) => filtros.km !== SIN_FILTROS.km,
    quitar: (filtros) => ({ ...filtros, km: SIN_FILTROS.km }),
    pasa: (oficina, filtros) => filtros.km === KM_MAXIMO || oficina.km <= filtros.km,
  },
  franja: {
    nombre: 'franja horaria',
    puesto: (filtros) => filtros.franja !== SIN_FILTROS.franja,
    quitar: (filtros) => ({ ...filtros, franja: SIN_FILTROS.franja }),
    pasa: (oficina, filtros) =>
      filtros.franja === 'cualquiera' || enLaFranja(oficina.primerHueco, filtros.franja),
  },
  fecha: {
    nombre: 'fecha',
    puesto: (filtros) => filtros.cuando !== SIN_FILTROS.cuando,
    quitar: (filtros) => ({ ...filtros, cuando: SIN_FILTROS.cuando }),
    pasa: (oficina, filtros, referencia) =>
      filtros.cuando === 'cualquiera' ||
      antesDe(oficina.primerHueco, ultimoDia(referencia, DIAS[filtros.cuando])),
  },
}

/** Cómo se nombra un filtro dentro de una frase o en el botón que lo quita. */
export function nombreDelFiltro(filtro: Filtro): string {
  return FILTROS[filtro].nombre
}

export function aplicando(
  oficinas: OficinaConSuTramite[],
  filtros: Filtros,
  /** Desde cuándo se cuentan «hoy», «esta semana» y «este mes». */
  referencia: number,
): OficinaConSuTramite[] {
  const dentro = oficinas.filter((oficina) =>
    CUALES.every((cual) => FILTROS[cual].pasa(oficina, filtros, referencia)),
  )
  return ordenando(dentro, filtros.orden)
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
): Filtro[] {
  // Sin oficinas no hay nada tapado: lo que pasa es que no ha llegado nada, y
  // eso ya lo cuenta el resumen de la búsqueda.
  if (oficinas.length === 0) return []
  if (aplicando(oficinas, filtros, referencia).length > 0) return []

  return CUALES.filter(
    (cual) =>
      FILTROS[cual].puesto(filtros) &&
      aplicando(oficinas, quitando(filtros, cual), referencia).length > 0,
  )
}

/**
 * Por qué no queda ninguna, dicho para poder arreglarlo.
 *
 * Cuando no hay ningún filtro que las devuelva por sí solo se dice eso mismo:
 * ofrecer quitar uno cualquiera sería mandar a alguien a pulsar un botón que lo
 * deja donde estaba.
 */
export function porQueNoQuedaNinguna(tapando: Filtro[]): string {
  if (tapando.length === 0) return 'Quita los filtros para volver a la lista completa.'

  const nombres = tapando.map(nombreDelFiltro)
  const [primero] = nombres
  if (nombres.length === 1) return `El filtro de ${primero} es el que las está tapando.`

  const ultimo = nombres[nombres.length - 1]
  return `Los filtros de ${nombres.slice(0, -1).join(', ')} y ${ultimo} son los que las están tapando.`
}

/** Si hay algo puesto que esté dejando oficinas fuera. El orden no deja a nadie fuera. */
export function hayFiltros(filtros: Filtros): boolean {
  return CUALES.some((cual) => FILTROS[cual].puesto(filtros))
}

/** Los mismos filtros sin ese. El orden elegido se respeta: no es un filtro. */
export function quitando(filtros: Filtros, filtro: Filtro): Filtros {
  return FILTROS[filtro].quitar(filtros)
}

/** Vuelta al resultado completo, conservando por qué se ordenaba. */
export function quitandoTodos(filtros: Filtros): Filtros {
  return { ...SIN_FILTROS, orden: filtros.orden }
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

function antesDe(primerHueco: string | null, ultimo: string): boolean {
  if (primerHueco === null) return false
  // Por día y no por hora: quien pide «esta semana» no está pidiendo «dentro de
  // ciento sesenta y ocho horas», y cortar a la hora exacta dejaría fuera un
  // hueco del último día por haber preguntado por la tarde.
  return primerHueco.slice(0, 10) <= ultimo
}

/**
 * El último día que entra, escrito como lo escribe el SEPE (`2026-08-23`).
 *
 * Las fechas se comparan como cadenas, igual que en el resto de la aplicación:
 * ese formato ordena escrito igual que en el tiempo, y así no hay que meter en
 * la comparación una zona horaria que las horas del SEPE no traen. El día se
 * saca con el reloj del navegador, que es el mismo con el que se escriben las
 * horas en la lista.
 */
function ultimoDia(referencia: number, dias: number): string {
  const fecha = new Date(referencia)
  fecha.setDate(fecha.getDate() + dias - 1)
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
  if (filtros.km !== SIN_FILTROS.km) partes.set('km', String(filtros.km))
  if (filtros.franja !== SIN_FILTROS.franja) partes.set('franja', filtros.franja)
  if (filtros.cuando !== SIN_FILTROS.cuando) partes.set('cuando', filtros.cuando)
  if (filtros.orden !== SIN_FILTROS.orden) partes.set('orden', filtros.orden)
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
    km: kmDe(partes.get('km')),
    franja: unaDe(FRANJAS, partes.get('franja'), SIN_FILTROS.franja),
    cuando: unaDe(CUANDOS, partes.get('cuando'), SIN_FILTROS.cuando),
    orden: unaDe(ORDENES, partes.get('orden'), SIN_FILTROS.orden),
  }
}

function kmDe(crudo: string | null): number {
  const km = Number(crudo)
  if (!Number.isInteger(km) || km < KM_MINIMO || km > KM_MAXIMO) return SIN_FILTROS.km
  return km
}

function unaDe<Valor extends string>(
  opciones: Opcion<Valor>[],
  crudo: string | null,
  porDefecto: Valor,
): Valor {
  return opciones.find((opcion) => opcion.valor === crudo)?.valor ?? porDefecto
}
