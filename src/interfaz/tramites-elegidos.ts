import type { GrupoDeTramites, TramiteEnCola } from '@/sepe/cola'
import type { LoQueVaLlegando } from './lo-que-va-llegando'

/**
 * Qué trámites se miran, y qué hay que ir a buscar para poder mirarlos.
 *
 * Mucha gente no sabe cómo se llama su trámite, así que aquí no se le hace
 * elegir uno: se le dejan **marcar varios**, y mientras no marque ninguno se
 * enseñan todos. Marcar es estrechar, y no es un paso previo a ver nada.
 *
 * Vive fuera del componente por lo mismo que `lo-que-va-llegando.ts`: lo que
 * puede salir mal aquí —un filtro que tira lo ya traído, o uno que vuelve a
 * preguntarle al SEPE por algo que ya se sabe— se lee y se prueba mejor sin
 * una pantalla montada por delante.
 */

/**
 * Por qué trámites se pregunta: por unos cuantos, o por los de la zona entera.
 *
 * `'todos'` no es la lista de todos escrita a mano, y la diferencia importa:
 * quién hay en la zona lo dice el SEPE en la cola, así que pedirlos por su
 * nombre exigiría saberlos antes de preguntarlos.
 */
export type PorQueSePregunta = number[] | 'todos'

/** Un grupo del SEPE con los trámites de la zona que cuelgan de él. */
export interface GrupoConSusTramites {
  grupo: GrupoDeTramites
  tramites: TramiteEnCola[]
}

/**
 * La cola repartida en los grupos del SEPE, sin tocarle el orden a ninguno de
 * los dos.
 *
 * El orden importa y no es estético: los nombres y su sitio en la lista son
 * los que quien pregunta va a volver a ver en la sede, y es por ahí por donde
 * va a reconocer el suyo. Reordenarlos alfabéticamente sería ponerle delante
 * una lista que no ha visto nunca.
 */
export function agrupados(tramites: TramiteEnCola[]): GrupoConSusTramites[] {
  const grupos = new Map<number, GrupoConSusTramites>()

  for (const tramite of tramites) {
    const grupo = grupos.get(tramite.grupo.id)
    if (grupo) grupo.tramites.push(tramite)
    else grupos.set(tramite.grupo.id, { grupo: tramite.grupo, tramites: [tramite] })
  }

  return [...grupos.values()]
}

/** Lo marcado después de marcar o desmarcar uno. */
export function marcando(elegidos: number[], id: number, marcado: boolean): number[] {
  if (!marcado) return elegidos.filter((elegido) => elegido !== id)
  return elegidos.includes(id) ? elegidos : [...elegidos, id]
}

/**
 * Lo que va llegando, visto solo por los trámites marcados.
 *
 * **Filtra la vista y no el estado**: lo desmarcado sigue entero dentro de
 * `estado`, que es lo que hace que volver a marcarlo no cueste otra consulta
 * al SEPE. Sale lo mismo que entró cuando no hay nada marcado, para que la
 * pantalla no tenga que distinguir los dos casos.
 */
export function soloLoElegido(estado: LoQueVaLlegando, elegidos: number[]): LoQueVaLlegando {
  if (elegidos.length === 0) return estado

  const elegido = new Set(elegidos)

  return {
    ...estado,
    cola: estado.cola.filter((tramite) => elegido.has(tramite.id)),
    resueltos: estado.resueltos.filter((resuelto) => elegido.has(resuelto.idTramite)),
    // Contar el progreso de un trámite que no se mira sería decir «consultando
    // X» al lado de un «faltan 0 trámites» que lo desmiente.
    consultando: estado.consultando && elegido.has(estado.consultando.id) ? estado.consultando : null,
  }
}

/**
 * Los trámites marcados que hay que ir a pedirle al SEPE: los que no han
 * llegado todavía y por los que no está preguntando ya nadie.
 *
 * `enCamino` es lo que cubre la pasada que esté abierta —`'todos'` cuando es
 * la de la zona entera— más lo que ya esté esperando turno. Sin eso, marcar un
 * trámite que está a punto de llegar abriría una segunda pasada para pedir lo
 * mismo, y el freno del SEPE lo pagaría dos veces.
 *
 * Solo se pide lo que está en la cola de la zona: el fragmento de la dirección
 * lo escribe cualquiera, y un identificador inventado ahí no puede acabar
 * convertido en una petición al SEPE.
 */
export function loQueHayQuePedir(
  elegidos: number[],
  estado: LoQueVaLlegando,
  enCamino: PorQueSePregunta,
): number[] {
  if (enCamino === 'todos') return []

  const enLaZona = new Set(estado.cola.map((tramite) => tramite.id))
  const sabido = new Set([...estado.resueltos.map((resuelto) => resuelto.idTramite), ...enCamino])

  return elegidos.filter((id) => enLaZona.has(id) && !sabido.has(id))
}
