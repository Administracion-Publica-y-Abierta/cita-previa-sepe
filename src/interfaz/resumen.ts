import type { EstadoDeLaCola } from '@/sepe/cola'
import { enHoraDeConsulta } from './formato'
import { cuantosFaltan, type LoQueVaLlegando, type OficinaConSuTramite } from './lo-que-va-llegando'

/**
 * Qué se le dice a quien pregunta en cada momento.
 *
 * Vive aparte del componente por lo mismo que `formato.ts`: son decisiones de
 * idioma y de honradez, no de maquetación, y se leen mejor todas juntas. La
 * regla que las gobierna es una sola: **ninguno de los fallos del SEPE se
 * cuenta como «no hay citas»**, porque quien lee «no hay citas» deja de mirar,
 * y lo que ha pasado es que no se ha podido preguntar.
 *
 * De esa regla sale la forma de lo que se devuelve, que son tres cosas y no un
 * texto. Está medido que el mismo trámite devuelve vacío y 46 oficinas con
 * treinta segundos de diferencia, así que **«no hay huecos» y «el SEPE no está
 * contestando» tienen que verse y leerse distinto**: lo primero es el titular,
 * lo segundo es un percance, y la pantalla los pinta aparte —y un lector de
 * pantalla anuncia el percance como alerta— justamente para que no se
 * confundan. Debajo va siempre de cuándo es el dato: sin eso, una lista de
 * hace media hora se lee igual que una de ahora.
 *
 * Y desde que la búsqueda llega a trozos hay una segunda regla: mientras siga
 * llegando, **se dice qué se está consultando y cuánto falta**. Una pantalla
 * que se queda callada cuarenta segundos es una pantalla que parece colgada, y
 * quien la ve así se va.
 */

const EMPEZANDO = 'Buscando oficinas. Puede tardar un minuto: al SEPE se le pregunta despacio a propósito.'

const SIN_CONEXION = 'No se ha podido conectar. Comprueba la conexión y vuelve a probar.'

/** La pasada se quedó a medias, pero lo que ya había llegado sigue en la lista. */
const SE_CORTO = 'La conexión se ha cortado antes de terminar: quedaban trámites por consultar.'

/** Se acabó la búsqueda y no llegó ni un trámite. No es que no haya citas. */
const NI_UNO = 'No se ha podido consultar ningún trámite. Vuelve a probar en un momento.'

/** El SEPE contestó, y lo que dice es que aquí no ofrece cita para nada. */
const SIN_TRAMITES = 'El SEPE no ofrece ningún trámite con cita previa en esta zona.'

/** El SEPE contestó, y lo que dice es que estos trámites no se atienden por aquí. */
const NINGUNA_OFICINA = 'El SEPE no atiende estos trámites en ninguna oficina de la zona.'

/**
 * Lo que ha impedido contestar.
 *
 * El tono no es decoración: `averia` es que **no se ha podido preguntar** —el
 * SEPE no contesta, no hay red— y `aviso` es que se preguntó y lo que vino no
 * es un resultado. Los dos se pintan aparte del titular, porque ninguno de los
 * dos es «no hay huecos».
 */
export interface Percance {
  tono: 'aviso' | 'averia'
  texto: string
}

/** De cuándo es lo que se está mirando, y si eso ya es viejo. */
export interface Frescura {
  texto: string
  /** Se sirvió pasado su plazo porque el SEPE no contestaba. Se pinta como aviso. */
  viejo: boolean
}

export interface LoQueSeDice {
  /** El titular: lo que hay. Vive en la región viva y se anuncia al cambiar. */
  resumen: string
  /** Lo que ha impedido contestar, cuando ha pasado algo. Se anuncia como alerta. */
  percance: Percance | null
  /** `null` mientras no se esté mirando ningún dato del SEPE. */
  frescura: Frescura | null
}

const NADA_QUE_DECIR: LoQueSeDice = { resumen: '', percance: null, frescura: null }

/** Si hay algo que contar, o la pantalla se queda como estaba. */
export function seCuentaAlgo(estado: LoQueVaLlegando): boolean {
  // De un código postal rechazado no se dice nada aquí: su aviso va pegado al
  // campo, que es donde está el arreglo. Y en `inicial` no se ha buscado
  // todavía: un «Resultados» con nada debajo es ruido en la pantalla que tiene
  // que entenderse en cinco segundos.
  return estado.fase !== 'inicial' && estado.fase !== 'rechazado'
}

/**
 * El trámite en el título mientras solo ha contestado uno: la lista son las
 * oficinas *de algo*, y quien pregunta no ha elegido ese algo. En cuanto hay
 * varios, el nombre se dice en cada oficina —que es donde importa, porque el
 * hueco es de un trámite concreto— y aquí se cuentan.
 *
 * Se cuentan **los que han contestado** y no los que se han intentado: un
 * trámite del que el SEPE no dijo nada no es un resultado, y meterlo en la
 * cuenta sería prometer en el título lo que la lista no tiene.
 */
export function tituloDe(estado: LoQueVaLlegando): string {
  const contestados = queContestaron(estado)
  const [primero] = contestados
  if (contestados.length === 1 && primero) return `Resultados para «${primero.nombreTramite}»`
  if (contestados.length > 1) return `Resultados de ${contestados.length} trámites`
  return 'Resultados'
}

export function loQueSeDice(estado: LoQueVaLlegando, oficinas: OficinaConSuTramite[]): LoQueSeDice {
  switch (estado.fase) {
    case 'inicial':
    case 'rechazado':
      return NADA_QUE_DECIR
    case 'sin-conexion':
      return sinConexion(estado, oficinas)
    case 'buscando':
    case 'terminada':
      return deLaPasada(estado, oficinas)
  }
}

/**
 * Quedarse girando para siempre no es una opción, así que se dice. Y lo que ya
 * había llegado no se tira: son oficinas de verdad, y siguen en la lista.
 */
function sinConexion(estado: LoQueVaLlegando, oficinas: OficinaConSuTramite[]): LoQueSeDice {
  // Se mira quién contestó y no cuántos se resolvieron: un trámite que se
  // resolvió en fallo no es nada que enseñar. Y cuando no hay nada que enseñar,
  // lo que hay que contar es **por qué**, que no siempre es la red: si el SEPE
  // ya no contestaba antes de que se fuera, eso es lo que ha pasado. Decir
  // «se ha cortado la conexión» lo taparía y además lo bajaría de avería a
  // aviso, que es justo la distinción que este fichero existe para sostener.
  if (queContestaron(estado).length === 0) {
    return {
      resumen: '',
      percance: loQueImpidio(estado) ?? { tono: 'averia', texto: SIN_CONEXION },
      frescura: null,
    }
  }

  return {
    resumen: titularDeLasOficinas(estado, oficinas),
    percance: { tono: 'aviso', texto: SE_CORTO },
    frescura: frescuraDe(estado),
  }
}

function deLaPasada(estado: LoQueVaLlegando, oficinas: OficinaConSuTramite[]): LoQueSeDice {
  // Lo primero es si se ha podido saber qué trámites hay: sin cola no hay nada
  // que resumir, y lo que ha pasado no es que no haya citas.
  if (estado.estadoDeLaCola && estado.estadoDeLaCola !== 'ok') {
    const percance = percanceDe(estado.estadoDeLaCola)
    // `sin-tramites` es lo único de aquí que sí es una respuesta del SEPE: no
    // hay percance que contar, hay un titular.
    return { resumen: percance ? '' : SIN_TRAMITES, percance, frescura: null }
  }

  if (estado.resueltos.length === 0) {
    // Una pasada terminada sin un solo trámite no puede seguir diciendo que
    // busca: ya no busca, y lo que ha pasado tampoco es que no haya citas.
    if (estado.fase !== 'buscando') {
      return { resumen: '', percance: { tono: 'averia', texto: NI_UNO }, frescura: null }
    }
    return { resumen: unaLinea(EMPEZANDO, loQueSeConsulta(estado)), percance: null, frescura: null }
  }

  return {
    resumen: unaLinea(
      titularDeLasOficinas(estado, oficinas),
      loQueSeConsulta(estado),
      loQueQuedoSinConsultar(estado),
    ),
    // Aunque haya oficinas: un trámite que no contestó deja la lista
    // incompleta, y enseñarla callando eso es la misma mentira que confundir
    // un SEPE caído con que no haya citas.
    percance: loQueImpidio(estado),
    frescura: frescuraDe(estado),
  }
}

/**
 * Sin `default`, y los estados escritos uno a uno: el día que aparezca otro,
 * esto deja de compilar. Con un `default` que cayera en cualquiera de estos
 * textos, un estado nuevo se contaría como algo que ya se sabe qué es.
 */
function percanceDe(estado: EstadoDeLaCola): Percance | null {
  switch (estado) {
    case 'sepe-no-responde':
      return {
        tono: 'averia',
        texto:
          'El SEPE no responde ahora mismo. No es que no haya citas: es que no se le ha podido preguntar. Vuelve a probar en un rato.',
      }
    case 'sin-agenda':
      return {
        tono: 'aviso',
        texto:
          'El SEPE ha contestado sin agenda. Le pasa a ratos y no significa que no haya citas. Vuelve a probar en un rato.',
      }
    // Tampoco esto es «no hay citas»: es que ahora mismo hay cola. El freno no
    // ha dado ficha, y saltárselo no era una opción.
    case 'vuelve-en-un-momento':
      return {
        tono: 'aviso',
        texto:
          'Ahora mismo hay mucha gente mirando y no se ha podido preguntar al SEPE sin atropellarlo. Vuelve a probar en un momento.',
      }
    // Los dos que sí son una respuesta del SEPE: lo que dicen cabe en el
    // titular, y volver a intentarlo no lo va a cambiar.
    case 'sin-tramites':
    case 'ok':
      return null
  }
}

/** Lo primero que ha ido mal de lo que ha llegado, si es que ha ido algo mal. */
function loQueImpidio(estado: LoQueVaLlegando): Percance | null {
  const fallido = estado.resueltos.find((resuelto) => resuelto.estado !== 'ok')
  return fallido ? percanceDe(fallido.estado) : null
}

/**
 * De cuándo es lo que se está mirando.
 *
 * Solo cuentan los trámites que contestaron: el instante de uno que falló es el
 * del fallo, no el de un dato, y no hay nada suyo en la lista.
 */
function frescuraDe(estado: LoQueVaLlegando): Frescura | null {
  const contestados = queContestaron(estado)
  if (contestados.length === 0) return null

  // El más viejo y no el más reciente. La lista funde las oficinas de todos los
  // trámites, así que la frescura que se puede prometer es la del peor: decir
  // la del último dejaría por recién consultada media lista que no lo está.
  const hora = enHoraDeConsulta(Math.min(...contestados.map((resuelto) => resuelto.consultadoEn)))
  const viejo = contestados.some((resuelto) => resuelto.caducada)

  return {
    viejo,
    texto: viejo
      ? `Consultado a las ${hora}: estos datos no son de ahora y el SEPE no contesta para actualizarlos.`
      : `Consultado a las ${hora}.`,
  }
}

/** Los trámites de los que hay respuesta del SEPE, que son los que se están mirando. */
function queContestaron(estado: LoQueVaLlegando) {
  return estado.resueltos.filter((resuelto) => resuelto.estado === 'ok')
}

/**
 * Qué se está consultando y cuánto falta, mientras siga llegando.
 *
 * Sale pegado a lo que ya hay y no en lugar de ello: lo que se ha traído se
 * sigue leyendo mientras el resto llega.
 */
function loQueSeConsulta(estado: LoQueVaLlegando): string {
  if (estado.fase !== 'buscando') return ''

  const faltan = cuantosFaltan(estado)
  if (estado.consultando) return `Consultando «${estado.consultando.nombre}». ${loQueQueda(faltan)}`
  if (faltan > 0) return loQueQueda(faltan)
  return ''
}

function loQueQueda(faltan: number): string {
  return faltan === 1 ? 'Falta 1 trámite por consultar.' : `Faltan ${faltan} trámites por consultar.`
}

/**
 * Una pasada que acaba dejándose trámites lo dice.
 *
 * Pasa cuando el servidor deja de avanzar y se corta la cadena de peticiones.
 * Callarlo enseñaría «12 oficinas, 5 con hueco» como si fuera todo lo que hay,
 * que es la misma mentira que no distinguir un SEPE caído de que no haya citas.
 */
function loQueQuedoSinConsultar(estado: LoQueVaLlegando): string {
  if (estado.fase !== 'terminada') return ''

  const sinConsultar = cuantosFaltan(estado)
  if (sinConsultar === 0) return ''

  return sinConsultar === 1
    ? 'Ha quedado 1 trámite sin consultar: vuelve a probar para verlo.'
    : `Han quedado ${sinConsultar} trámites sin consultar: vuelve a probar para verlos.`
}

function titularDeLasOficinas(estado: LoQueVaLlegando, oficinas: OficinaConSuTramite[]): string {
  if (oficinas.length === 0) {
    // Que no haya oficinas solo se puede afirmar si **todos** contestaron: con
    // uno que no lo hiciera, «no atiende estos trámites en ninguna oficina»
    // está hablando también de aquel del que no se sabe nada. De lo que falló
    // se encarga el percance; aquí no se dice nada, que es lo honrado.
    const todosContestaron =
      estado.resueltos.length > 0 && queContestaron(estado).length === estado.resueltos.length
    return todosContestaron ? NINGUNA_OFICINA : ''
  }

  const conHueco = oficinas.filter((oficina) => oficina.primerHueco !== null).length
  const donde = estado.localizacion?.municipio ?? estado.localizacion?.provincia ?? 'tu zona'
  const cabecera =
    oficinas.length === 1 ? `1 oficina cerca de ${donde}` : `${oficinas.length} oficinas cerca de ${donde}`

  const huecos =
    conHueco === 0 ? 'ninguna con hueco ahora mismo.' : conHueco === 1 ? '1 con hueco.' : `${conHueco} con hueco.`

  return `${cabecera}, ${huecos}`
}

/** Las frases que haya, separadas por un espacio y sin huecos de las que falten. */
function unaLinea(...partes: string[]): string {
  return partes.filter((parte) => parte !== '').join(' ')
}
