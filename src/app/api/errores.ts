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

/** El código postal que llega en el cuerpo de un POST, o la cadena vacía. */
export async function codigoPostalDe(peticion: Request): Promise<string> {
  const cuerpo = (await peticion.json().catch(() => null)) as { cp?: unknown } | null
  return typeof cuerpo?.cp === 'string' ? cuerpo.cp : ''
}
