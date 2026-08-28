import type { EstadoDeLaCola } from '@/sepe/cola'
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
 * Y desde que la búsqueda llega a trozos hay una segunda: mientras siga
 * llegando, **se dice qué se está consultando y cuánto falta**. Una pantalla
 * que se queda callada cuarenta segundos es una pantalla que parece colgada, y
 * quien la ve así se va.
 */

const EMPEZANDO = 'Buscando oficinas. Puede tardar un minuto: al SEPE se le pregunta despacio a propósito.'

const SIN_CONEXION = 'No se ha podido conectar. Comprueba la conexión y vuelve a probar.'

/** Se acabó la búsqueda y no llegó ni un trámite. No es que no haya citas. */
const NI_UNO = 'No se ha podido consultar ningún trámite. Vuelve a probar en un momento.'

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
  const contestados = estado.resueltos.filter((resuelto) => resuelto.estado === 'ok')
  const [primero] = contestados
  if (contestados.length === 1 && primero) return `Resultados para «${primero.nombreTramite}»`
  if (contestados.length > 1) return `Resultados de ${contestados.length} trámites`
  return 'Resultados'
}

export function resumenDe(estado: LoQueVaLlegando, oficinas: OficinaConSuTramite[]): string {
  switch (estado.fase) {
    case 'inicial':
    case 'rechazado':
      return ''
    case 'sin-conexion':
      // Lo que ya había llegado no se tira: son oficinas de verdad, y siguen en
      // la lista. Lo que se dice es que la pasada se quedó a medias.
      if (estado.resueltos.length === 0) return SIN_CONEXION
      return `${resumenDeLasOficinas(estado, oficinas)} La conexión se ha cortado antes de terminar: quedaban trámites por consultar.`
    case 'buscando':
    case 'terminada':
      return resumenDeLaPasada(estado, oficinas)
  }
}

function resumenDeLaPasada(estado: LoQueVaLlegando, oficinas: OficinaConSuTramite[]): string {
  // Lo primero es si se ha podido saber qué trámites hay: sin cola no hay nada
  // que resumir, y lo que ha pasado no es que no haya citas.
  if (estado.estadoDeLaCola && estado.estadoDeLaCola !== 'ok') return loQuePasa(estado.estadoDeLaCola)
  // Una pasada terminada sin un solo trámite no puede seguir diciendo que
  // busca: ya no busca, y lo que ha pasado tampoco es que no haya citas.
  if (estado.resueltos.length === 0) {
    return estado.fase === 'buscando' ? `${EMPEZANDO}${loQueSeConsulta(estado)}` : NI_UNO
  }

  return `${resumenDeLasOficinas(estado, oficinas)}${loQueSeConsulta(estado)}${loQueQuedoSinConsultar(estado)}${loViejoQueEs(estado)}`
}

/**
 * Sin `default`, y los estados escritos uno a uno: el día que aparezca otro,
 * esto deja de compilar. Con un `default` que cayera en cualquiera de estos
 * textos, un estado nuevo se contaría como algo que ya se sabe qué es.
 */
function loQuePasa(estado: EstadoDeLaCola): string {
  switch (estado) {
    case 'sepe-no-responde':
      return 'El SEPE no responde ahora mismo. No es que no haya citas: es que no se le ha podido preguntar. Vuelve a probar en un rato.'
    case 'sin-agenda':
      return 'El SEPE ha contestado sin agenda. Le pasa a ratos y no significa que no haya citas. Vuelve a probar en un rato.'
    case 'sin-tramites':
      return 'El SEPE no ofrece ningún trámite con cita previa en esta zona.'
    // Tampoco esto es «no hay citas»: es que ahora mismo hay cola. El freno no
    // ha dado ficha, y saltárselo no era una opción.
    case 'vuelve-en-un-momento':
      return 'Ahora mismo hay mucha gente mirando y no se ha podido preguntar al SEPE sin atropellarlo. Vuelve a probar en un momento.'
    case 'ok':
      return ''
  }
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
  if (estado.consultando) return ` Consultando «${estado.consultando.nombre}». ${loQueQueda(faltan)}`
  if (faltan > 0) return ` ${loQueQueda(faltan)}`
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
    ? ' Ha quedado 1 trámite sin consultar: vuelve a probar para verlo.'
    : ` Han quedado ${sinConsultar} trámites sin consultar: vuelve a probar para verlos.`
}

function resumenDeLasOficinas(estado: LoQueVaLlegando, oficinas: OficinaConSuTramite[]): string {
  if (oficinas.length === 0) {
    // Ninguna oficina y algún trámite que no salió: lo que hay que contar es
    // eso. Decir «0 oficinas» de algo que no se ha podido preguntar es
    // exactamente la mentira que este fichero existe para evitar.
    const fallido = estado.resueltos.find((resuelto) => resuelto.estado !== 'ok')
    if (fallido) return loQuePasa(fallido.estado)
    return 'El SEPE no atiende estos trámites en ninguna oficina de la zona.'
  }

  const conHueco = oficinas.filter((oficina) => oficina.primerHueco !== null).length
  const donde = estado.localizacion?.municipio ?? estado.localizacion?.provincia ?? 'tu zona'
  const cabecera =
    oficinas.length === 1 ? `1 oficina cerca de ${donde}` : `${oficinas.length} oficinas cerca de ${donde}`

  const huecos =
    conHueco === 0 ? 'ninguna con hueco ahora mismo.' : conHueco === 1 ? '1 con hueco.' : `${conHueco} con hueco.`

  return `${cabecera}, ${huecos}`
}

/**
 * Cuando lo que se enseña no es de ahora, se dice.
 *
 * Una respuesta `caducada` es lo último bueno que había, servido porque el
 * SEPE no contesta: enseñarla sin avisar sería dar por vigente un hueco que
 * puede llevar horas cogido. Es lo mínimo para no mentir mientras llega el
 * aviso de frescura completo, que es el issue #12.
 */
function loViejoQueEs(estado: LoQueVaLlegando): string {
  if (!estado.resueltos.some((resuelto) => resuelto.caducada)) return ''
  return ' Son datos de hace un rato: el SEPE no contesta ahora mismo y se enseña lo último que se pudo guardar.'
}
