import { CodigoPostalInvalido } from '@/localizacion/geocodificador'

/**
 * Los errores que la API le enseña a una persona, en un solo sitio.
 *
 * Están escritos a mano y son siempre los mismos: nada de lo que llegue en la
 * petición se devuelve. Un mensaje que repite lo que ha tecleado quien pregunta
 * es a la vez una vía de inyección hacia la interfaz y una forma de que ese dato
 * acabe en el registro de errores del alojamiento sin que nadie lo haya
 * decidido.
 *
 * Y viven juntos porque los comen varias rutas: dos copias del mismo texto se
 * separan sin que nadie lo note, y el que se quede viejo se lo lleva quien
 * pregunta.
 */
export const CODIGO_POSTAL_INVALIDO = {
  error: 'codigo-postal-invalido',
  mensaje: 'El código postal debe tener cinco dígitos y empezar por una provincia española, del 01 al 52.',
}

/**
 * El esqueleto de las rutas que comen código postal: lo saca del cuerpo del
 * POST, se lo da a quien conteste y traduce el único error esperable.
 *
 * De la URL no se lee nada, ni la cadena de consulta: el alojamiento registra
 * la URL entera de cada petición solo por existir, así que lo que no se lee de
 * ahí es lo que no puede acabar escrito.
 */
export async function conCodigoPostal(
  peticion: Request,
  contestar: (codigoPostal: string) => Promise<unknown>,
): Promise<Response> {
  const cuerpo = (await peticion.json().catch(() => null)) as { cp?: unknown } | null
  const codigoPostal = typeof cuerpo?.cp === 'string' ? cuerpo.cp : ''

  try {
    return Response.json(await contestar(codigoPostal))
  } catch (error) {
    if (error instanceof CodigoPostalInvalido) {
      return Response.json(CODIGO_POSTAL_INVALIDO, { status: 400 })
    }
    // Lo demás sale tal cual: un fallo nuestro no se disfraza de código postal
    // mal escrito.
    throw error
  }
}
