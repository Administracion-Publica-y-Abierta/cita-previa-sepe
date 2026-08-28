import { CodigoPostalInvalido } from '@/localizacion/geocodificador'
import { appDeProduccion } from '@/nucleo/app-de-produccion'

/**
 * Un único mensaje, escrito a mano y siempre el mismo.
 *
 * Nada de lo que llegue en la petición se devuelve: un mensaje que repite lo
 * que ha tecleado quien pregunta es a la vez una vía de inyección hacia la
 * interfaz y una forma de que ese dato acabe en el registro de errores del
 * alojamiento sin que nadie lo haya decidido.
 */
const CODIGO_POSTAL_INVALIDO = {
  error: 'codigo-postal-invalido',
  mensaje: 'El código postal debe tener cinco dígitos y empezar por una provincia española, del 01 al 52.',
}

/**
 * `POST /api/localizacion` con `{"cp": "08401"}` → dónde cae ese código postal.
 *
 * Es POST y no GET por una sola razón, y no es de estilo: **el alojamiento
 * registra la URL entera de cada petición, la cadena de consulta incluida**, y
 * lo hace solo por existir, sin que nadie lo pida. Un `GET
 * /api/localizacion?cp=08401` deja escrito en el registro de Vercel de dónde es
 * cada persona que ha mirado si hay cita del paro; y en este proyecto eso, unido
 * al trámite, dice que alguien está en el paro. El cuerpo de un POST no se
 * registra.
 *
 * Lo que se pierde es que la consulta no se pueda compartir por enlace ni
 * guardar en favoritos. Aquí no hace falta: el hero recuerda el último código
 * postal en el propio navegador.
 */
export async function POST(peticion: Request): Promise<Response> {
  const cuerpo = (await peticion.json().catch(() => null)) as { cp?: unknown } | null
  const codigoPostal = typeof cuerpo?.cp === 'string' ? cuerpo.cp : ''

  try {
    return Response.json(await appDeProduccion().geocodificador.localizar(codigoPostal))
  } catch (error) {
    if (error instanceof CodigoPostalInvalido) {
      return Response.json(CODIGO_POSTAL_INVALIDO, { status: 400 })
    }
    throw error
  }
}
