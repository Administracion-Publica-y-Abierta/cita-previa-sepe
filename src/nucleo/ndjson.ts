/**
 * NDJSON: un objeto JSON por línea.
 *
 * Es el transporte de la búsqueda, y la elección tiene dos motivos. El primero
 * es que una pasada de nueve trámites dura unos 44 segundos y hay que ir
 * contando lo que llega; el segundo, por qué no es *Server-Sent Events*, que
 * sería lo primero que uno miraría: `EventSource` solo sabe hacer GET, y en
 * este proyecto el código postal **no puede ir en una URL** —el alojamiento
 * registra la URL entera de cada petición solo por existir—. Un objeto por
 * línea sobre un POST no necesita librería en ninguna de las dos puntas.
 *
 * Vive en `nucleo` porque lo usan las dos: la ruta escribe y el navegador lee.
 */

/** Lo que se le da a `Response`: una línea por valor, según se van produciendo. */
export function comoNdjson<T>(valores: AsyncIterable<T>): ReadableStream<Uint8Array> {
  const codificador = new TextEncoder()
  const iterador = valores[Symbol.asyncIterator]()

  // `pull` y no un bucle que lo empuja todo: así el productor solo avanza
  // cuando quien lee ha pedido más, y si el navegador se va a mitad de la
  // pasada se llama a `cancel` y se deja de consultar al SEPE.
  return new ReadableStream<Uint8Array>({
    async pull(control) {
      const { value, done } = await iterador.next()
      if (done) {
        control.close()
        return
      }
      control.enqueue(codificador.encode(`${JSON.stringify(value)}\n`))
    },

    async cancel(motivo) {
      await iterador.return?.(motivo)
    },
  })
}

/**
 * Lo de vuelta: los valores según van llegando.
 *
 * Se decodifica a mano y no con `TextDecoderStream` porque un objeto puede
 * llegar partido en dos trozos —una línea no tiene por qué caber en un
 * fragmento de red— y lo que queda a medias se guarda hasta que llegue el
 * resto.
 */
export async function* deNdjson<T>(cuerpo: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const lector = cuerpo.getReader()
  const decodificador = new TextDecoder()
  let aMedias = ''

  try {
    for (;;) {
      const { value, done } = await lector.read()
      if (done) break

      aMedias += decodificador.decode(value, { stream: true })
      const lineas = aMedias.split('\n')
      // La última no está terminada mientras no llegue su salto de línea.
      aMedias = lineas.pop() ?? ''

      for (const linea of lineas) if (linea.trim()) yield JSON.parse(linea) as T
    }

    if (aMedias.trim()) yield JSON.parse(aMedias) as T
  } finally {
    lector.releaseLock()
  }
}
