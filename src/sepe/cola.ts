import type { Almacen } from '@/almacen/almacen'
import type { ArbolDeTramites, Catalogo } from './catalogo'
import type { EstadoDeLaConsulta } from './consultas'
import type { Subtramite } from './niveles'

/**
 * Los trámites que hay que consultar en una zona, en el orden en que los lista
 * el SEPE.
 *
 * Es el catálogo puesto en fila. Existe aparte de `catalogo.ts` por una razón
 * que no es de estilo: **una pasada no cabe en una sola invocación** —nueve
 * trámites con el freno de 2,5 s son unos 44 segundos— y la que la continúa
 * necesita saber qué falta sin volver a descubrir el árbol, que son otras diez
 * peticiones frenadas.
 *
 * De ahí que la cola se guarde en el almacén compartido. Lo que se evita con
 * eso no es solo el gasto: la alternativa era que el navegador mandase de
 * vuelta los trámites que le faltan **con sus nombres**, y entonces la
 * respuesta llevaría dentro texto que ha llegado en una petición. Los nombres
 * de los trámites los dice el SEPE y nadie más.
 */

/**
 * Los estados de la consulta más uno propio: puede que el árbol esté bien y
 * aun así no haya nada que consultar.
 *
 * `sin-tramites` es información y no una avería, igual que `sin-agenda`: el
 * SEPE ha contestado, y lo que dice es que en esa zona no ofrece ningún
 * trámite con cita. La interfaz lo pinta distinto de un SEPE caído porque
 * volver a intentarlo no va a cambiar nada.
 */
export type EstadoDeLaCola = EstadoDeLaConsulta | 'sin-tramites'

/**
 * El trámite de nivel 2 del que cuelga un consultable.
 *
 * Es la forma en que el SEPE agrupa los suyos, y no una nuestra: en su sede se
 * elige primero en el combo «Trámite» y después en el de «Subtrámite», y el
 * segundo cuelga del primero. El nivel 1 no entra —lo llama «Tipo de oficina»,
 * que no agrupa trámites— y con eso el grupo es exactamente lo que quien
 * pregunta va a volver a ver allí.
 */
export interface GrupoDeTramites {
  id: number
  nombre: string
}

/**
 * Un trámite de la cola: el consultable de nivel 3, y de qué grupo del SEPE
 * viene.
 *
 * El grupo viaja pegado a cada trámite y no aparte porque la cola es una fila
 * —se consulta en el orden del SEPE— y no un árbol: quien la recorre no
 * necesita la agrupación, y quien la enseña la rehace mirando este campo.
 */
export interface TramiteEnCola extends Subtramite {
  grupo: GrupoDeTramites
}

export interface Cola {
  estado: EstadoDeLaCola
  /** Instante real de la consulta al SEPE, para poder decir de cuándo es el dato. */
  consultadoEn: number
  /** Los trámites consultables, en el orden en que los manda el SEPE. */
  tramites: TramiteEnCola[]
}

export interface ColaDeTramites {
  de(codigoPostal: string): Promise<Cola>
}

/**
 * Cuánto se conserva la cola de una zona.
 *
 * Un día, y no los noventa segundos de las consultas: lo que caduca deprisa son
 * los huecos, no el árbol de trámites. El SEPE lo cambia cuando lo cambia, y
 * descubrirlo cuesta una petición por rama y otra por trámite, todas frenadas.
 * No es un ajuste de despliegue —no depende de dónde corra esto— así que es una
 * constante y no un parámetro de configuración.
 */
export const VIDA_DE_LA_COLA_MS = 86_400_000

/**
 * Los trámites consultables del árbol, aplanados en el orden del SEPE y cada
 * uno con el grupo del que cuelga.
 *
 * Consultable quiere decir de nivel 3: es el único nivel cuyo identificador
 * entiende el mapa. Los trámites cuyo combo viene vacío —un caso real— no
 * aportan ninguno y no paran el recorrido.
 */
export function tramitesDelArbol(arbol: ArbolDeTramites): TramiteEnCola[] {
  return arbol.ramas.flatMap((rama) =>
    rama.tramites.flatMap((tramite) =>
      tramite.subtramites.map((subtramite) => ({
        ...subtramite,
        grupo: { id: tramite.id, nombre: tramite.nombre },
      })),
    ),
  )
}

export function crearColaDeTramites(piezas: {
  catalogo: Catalogo
  almacen: Almacen
}): ColaDeTramites {
  const { catalogo, almacen } = piezas

  /**
   * Se lee y se escribe fallando abierto: sin almacén la cola se vuelve a
   * descubrir, que es caro pero correcto. El que no puede fallar abierto es el
   * freno, y no lo hace.
   */
  async function recordada(clave: string): Promise<Cola | null> {
    try {
      const guardada = await almacen.leer<Cola>(clave)
      // Una cola guardada antes de que los trámites llevasen su grupo se
      // descarta y se vuelve a descubrir. Es un día de colas viejas como
      // mucho, y la alternativa —enseñarlas sin agrupar— sería un filtro de
      // trámites que unas zonas tienen y otras no según cuándo se consultaron
      // por última vez.
      return guardada && guardada.tramites.every((tramite) => tramite.grupo) ? guardada : null
    } catch {
      return null
    }
  }

  async function apuntar(clave: string, cola: Cola): Promise<void> {
    try {
      await almacen.guardar(clave, cola, VIDA_DE_LA_COLA_MS)
    } catch {
      // Que no se pueda guardar no invalida lo que ya se ha descubierto.
    }
  }

  return {
    async de(codigoPostal: string): Promise<Cola> {
      const clave = claveDe(codigoPostal)

      const guardada = await recordada(clave)
      if (guardada) return guardada

      const arbol = await catalogo.de(codigoPostal)

      // Un árbol que no está `ok` no trae trámites, y una cola sacada de una
      // lista que se sabe incompleta sería consultar cualquier cosa. El estado
      // del catálogo sale tal cual: la avería es suya.
      if (arbol.estado !== 'ok') return { estado: arbol.estado, consultadoEn: arbol.consultadoEn, tramites: [] }

      const tramites = tramitesDelArbol(arbol)
      const cola: Cola = {
        estado: tramites.length ? 'ok' : 'sin-tramites',
        consultadoEn: arbol.consultadoEn,
        tramites,
      }

      // Solo se recuerda una cola con algo dentro. Una zona sin trámites
      // guardada un día entero sería un día entero contestando que no hay nada
      // que consultar aunque el SEPE lo arreglara a los cinco minutos.
      if (cola.estado === 'ok') await apuntar(clave, cola)

      return cola
    },
  }
}

/**
 * La clave va por código postal completo y no por provincia, al revés que la
 * de las consultas: el árbol de trámites de un código postal es lo que el SEPE
 * ofrece **ahí**, y no hay nada medido que diga que dos zonas de la misma
 * provincia ofrecen lo mismo.
 */
function claveDe(codigoPostal: string): string {
  return `cola:${codigoPostal}`
}
