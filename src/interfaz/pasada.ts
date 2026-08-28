import { deNdjson } from '@/nucleo/ndjson'
import type { EventoDeLaPasada } from '@/sepe/pasada'
import type { FinDeLaBusqueda } from './lo-que-va-llegando'

/**
 * Escuchar la búsqueda, que ya no es preguntar y esperar.
 *
 * Está fuera del componente a propósito: así el efecto que la lanza no cambia
 * estado por su cuenta —solo lo hace cada evento, cuando llega— y esto se puede
 * leer sin saber nada de React.
 *
 * Hace además lo único que no se ve desde la pantalla: **una pasada no cabe en
 * una invocación**. Cuando el servidor cierra diciendo lo que le falta, esto
 * vuelve a pedir exactamente eso. No es sondeo: no se pregunta «¿ya está?»,
 * cada petición trae trámites resueltos.
 */

const RUTA = '/api/busqueda'

export async function seguirLaPasada(
  peticion: {
    codigoPostal: string
    /**
     * Los trámites por los que preguntar. Sin ellos se consulta la zona
     * entera, que es lo que pide el hero cuando nadie ha marcado nada.
     */
    tramites?: number[]
  },
  alLlegar: (evento: EventoDeLaPasada) => void,
  senal?: AbortSignal,
): Promise<FinDeLaBusqueda> {
  const { codigoPostal } = peticion
  let pendientes = peticion.tramites

  for (;;) {
    let respuesta: Response
    try {
      respuesta = await fetch(RUTA, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // El código postal va en el cuerpo y no en la URL: el alojamiento
        // registra la URL entera de cada petición solo por existir.
        body: JSON.stringify(
          pendientes?.length ? { cp: codigoPostal, tramites: pendientes } : { cp: codigoPostal },
        ),
        signal: senal,
      })
    } catch {
      return senal?.aborted ? 'abandonada' : 'sin-conexion'
    }

    if (respuesta.status === 400) return 'rechazado'
    if (!respuesta.ok || !respuesta.body) return 'sin-conexion'

    let siguientes: number[] | null = null
    try {
      for await (const evento of deNdjson<EventoDeLaPasada>(respuesta.body)) {
        if (evento.tipo === 'pendientes') siguientes = evento.tramites.map((tramite) => tramite.id)
        alLlegar(evento)
      }
    } catch {
      // Un streaming que se corta a la mitad deja lo que ya había llegado: se
      // deja de pedir, pero no se tira lo que ya se sabe.
      return senal?.aborted ? 'abandonada' : 'sin-conexion'
    }

    if (!siguientes?.length) return 'terminada'

    // Si lo que falta no ha menguado, la siguiente petición tampoco iba a
    // avanzar. Mejor una lista incompleta que una cadena de peticiones al SEPE
    // que no lleva a ninguna parte.
    if (pendientes && siguientes.length >= pendientes.length) return 'terminada'

    pendientes = siguientes
  }
}
