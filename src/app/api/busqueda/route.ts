import { CodigoPostalInvalido, exigirProvincia } from '@/localizacion/geocodificador'
import { comoNdjson } from '@/nucleo/ndjson'
import { appDeProduccion } from '@/nucleo/app-de-produccion'
import { CODIGO_POSTAL_INVALIDO } from '../errores'

/**
 * `POST /api/busqueda` con `{"cp": "08401"}` → las oficinas de los trámites de
 * esa zona, **en streaming**: un objeto JSON por línea, uno por trámite
 * resuelto, según se van sabiendo.
 *
 * No devuelve un resultado porque no lo hay hasta pasados unos 44 segundos, y
 * eso no lo mira nadie. Lo que hace es ir contando: qué se está consultando y
 * qué ha salido. Quien escucha pinta el mapa con el primero.
 *
 * Es POST y no GET por la misma razón que las otras rutas, y no es de estilo:
 * **el alojamiento registra la URL entera de cada petición, la cadena de
 * consulta incluida**, y lo hace solo por existir. Un `GET
 * /api/busqueda?cp=08401` deja escrito en el registro de dónde es cada persona
 * que ha mirado si hay cita del paro. El cuerpo de un POST no se registra. Es
 * también lo que descarta *Server-Sent Events*, que solo sabe hacer GET.
 *
 * **Una invocación no sostiene la pasada entera.** Cuando se le acaba el
 * presupuesto cierra la respuesta con la lista de lo que falta, y quien
 * escucha vuelve a pedir eso. Cada petición trae resultados: no es sondeo.
 */

/**
 * Lo que Vercel permite estirar una función. La pasada se corta ella sola muy
 * por debajo —`PRESUPUESTO_DE_LA_INVOCACION_MS`—; esto es solo el techo del que
 * ese presupuesto deja margen.
 */
export const maxDuration = 60

interface CuerpoDeLaPeticion {
  cp?: unknown
  tramites?: unknown
}

export async function POST(peticion: Request): Promise<Response> {
  const cuerpo = (await peticion.json().catch(() => null)) as CuerpoDeLaPeticion | null
  const codigoPostal = typeof cuerpo?.cp === 'string' ? cuerpo.cp : ''

  // Se comprueba aquí y no dentro del generador porque una vez empezada la
  // respuesta ya no se puede contestar 400: la cabecera se ha ido. Es la misma
  // tabla de provincias que usa el geocodificador, así que no pueden discrepar.
  try {
    exigirProvincia(codigoPostal)
  } catch (error) {
    if (error instanceof CodigoPostalInvalido) return Response.json(CODIGO_POSTAL_INVALIDO, { status: 400 })
    // Lo demás sale tal cual: un fallo nuestro no se disfraza de código postal
    // mal escrito.
    throw error
  }

  const eventos = appDeProduccion().pasada.eventos({ codigoPostal, idsTramites: idsDe(cuerpo?.tramites) })

  return new Response(comoNdjson(eventos), {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      // Una pasada a medias no se guarda en ninguna caché intermedia: lo que
      // se devuelve depende de la hora a la que se pregunte.
      'cache-control': 'no-store',
    },
  })
}

/**
 * Los identificadores que trae la petición, o ninguno.
 *
 * Se filtra a números de verdad y no se toca nada más de lo que llega: los
 * identificadores que no estén en la cola de esa zona no se consultan, así que
 * lo peor que puede hacer una lista inventada es no consultar nada.
 */
function idsDe(crudo: unknown): number[] | undefined {
  if (!Array.isArray(crudo)) return undefined
  return crudo.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
}
