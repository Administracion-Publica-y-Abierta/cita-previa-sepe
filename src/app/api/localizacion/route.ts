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
 * `GET /api/localizacion?cp=08401` → dónde cae ese código postal.
 *
 * El código postal va en el parámetro de consulta y nunca en la ruta: el
 * alojamiento registra la ruta de cada petición sin que nadie se lo pida, y una
 * ruta `/api/localizacion/08401` dejaría escrito en su registro de dónde es
 * cada persona que ha mirado si hay cita del paro.
 */
export async function GET(peticion: Request): Promise<Response> {
  const codigoPostal = new URL(peticion.url).searchParams.get('cp') ?? ''

  try {
    return Response.json(await appDeProduccion().geocodificador.localizar(codigoPostal))
  } catch (error) {
    if (error instanceof CodigoPostalInvalido) {
      return Response.json(CODIGO_POSTAL_INVALIDO, { status: 400 })
    }
    throw error
  }
}
