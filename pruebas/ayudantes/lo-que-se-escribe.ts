import { vi } from 'vitest'

/**
 * Lo que la aplicación escriba mientras corre el bloque, línea a línea.
 *
 * Existe porque la regla del registro no se prueba mirando la respuesta: lo que
 * hay que impedir es que un código postal acabe escrito en el registro del
 * alojamiento, donde ya no se recupera y donde el fallo no da la cara. La
 * aplicación funciona igual de bien mientras lo hace.
 *
 * Se espían los cinco métodos y no solo `warn`: si alguien añade mañana un
 * `console.error`, tiene que caer aquí y no colarse.
 */
export async function loQueSeEscribe(bloque: () => Promise<unknown>): Promise<string[]> {
  const escrito: string[] = []
  for (const metodo of ['debug', 'log', 'info', 'warn', 'error'] as const) {
    vi.spyOn(console, metodo).mockImplementation((...partes: unknown[]) => {
      escrito.push(partes.map(String).join(' '))
    })
  }
  await bloque()
  return escrito
}
