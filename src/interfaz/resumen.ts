import type { BusquedaDelPrimerTramite } from '@/sepe/primer-tramite'
import type { Estado } from './consulta'

/**
 * Qué se le dice a quien pregunta en cada caso.
 *
 * Vive aparte del componente por lo mismo que `formato.ts`: son decisiones de
 * idioma y de honradez, no de maquetación, y se leen mejor todas juntas. La
 * regla que las gobierna es una sola: **ninguno de los tres fallos del SEPE se
 * cuenta como «no hay citas»**, porque quien lee «no hay citas» deja de mirar,
 * y lo que ha pasado es que no se ha podido preguntar.
 */

/** Si hay algo que contar, o la pantalla se queda como estaba. */
export function seCuentaAlgo(estado: Estado): boolean {
  // De un código postal rechazado no se dice nada aquí: su aviso va pegado al
  // campo, que es donde está el arreglo. Y en `inicial` no se ha buscado
  // todavía: un «Resultados» con nada debajo es ruido en la pantalla que tiene
  // que entenderse en cinco segundos.
  return estado.fase === 'buscando' || estado.fase === 'hecho' || estado.fase === 'sin-conexion'
}

export function tituloDe(busqueda: BusquedaDelPrimerTramite | null): string {
  // El trámite en el título y no en letra pequeña: la lista son las oficinas
  // *de algo*, y quien pregunta no ha elegido ese algo.
  return busqueda?.tramite ? `Resultados para «${busqueda.tramite.nombre}»` : 'Resultados'
}

export function resumenDe(estado: Estado): string {
  switch (estado.fase) {
    case 'inicial':
    case 'rechazado':
      return ''
    case 'buscando':
      return 'Buscando oficinas. Puede tardar un minuto: al SEPE se le pregunta despacio a propósito.'
    case 'sin-conexion':
      return 'No se ha podido conectar. Comprueba la conexión y vuelve a probar.'
    case 'hecho':
      return resumenDeLaBusqueda(estado.busqueda)
  }
}

/**
 * Sin `default`, y los cuatro estados escritos uno a uno: el día que aparezca
 * un quinto, esto deja de compilar. Con un `default` que cayera en el resumen
 * de las oficinas, un estado nuevo se contaría como una búsqueda buena y
 * diría «0 oficinas» de algo que ni siquiera se ha preguntado.
 */
function resumenDeLaBusqueda(busqueda: BusquedaDelPrimerTramite): string {
  switch (busqueda.estado) {
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
      return resumenDeLasOficinas(busqueda)
  }
}

function resumenDeLasOficinas(busqueda: BusquedaDelPrimerTramite): string {
  const cuantas = busqueda.oficinas.length
  if (cuantas === 0) return 'El SEPE no atiende este trámite en ninguna oficina de la zona.'

  const conHueco = busqueda.oficinas.filter((oficina) => oficina.primerHueco !== null).length
  const donde = busqueda.localizacion?.municipio ?? busqueda.localizacion?.provincia ?? 'tu zona'
  const cabecera = cuantas === 1 ? `1 oficina cerca de ${donde}` : `${cuantas} oficinas cerca de ${donde}`

  const huecos =
    conHueco === 0 ? 'ninguna con hueco ahora mismo.' : conHueco === 1 ? '1 con hueco.' : `${conHueco} con hueco.`

  return `${cabecera}, ${huecos}${loViejoQueEs(busqueda)}`
}

/**
 * Cuando lo que se enseña no es de ahora, se dice.
 *
 * Una respuesta `caducada` es lo último bueno que había, servido porque el
 * SEPE no contesta: enseñarla sin avisar sería dar por vigente un hueco que
 * puede llevar horas cogido. Es lo mínimo para no mentir mientras llega el
 * aviso de frescura completo, que es el issue #12.
 */
function loViejoQueEs(busqueda: BusquedaDelPrimerTramite): string {
  if (!busqueda.caducada) return ''
  return ' Son datos de hace un rato: el SEPE no contesta ahora mismo y se enseña lo último que se pudo guardar.'
}
