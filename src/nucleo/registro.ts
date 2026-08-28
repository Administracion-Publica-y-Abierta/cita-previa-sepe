/**
 * El único sitio por el que la aplicación escribe en el registro.
 *
 * Existe por una regla, no por comodidad: en Vercel y en Supabase todo lo que
 * se imprime queda guardado, y un dato personal escrito ahí ya no se recupera.
 * Con un solo sitio, comprobar que no se escapa nada es leer un fichero.
 *
 * **Los mensajes son literales y no llevan interpolado nada de fuera**: ni lo
 * que teclea quien pregunta, ni el `message` de un error. Lo segundo se cuela
 * solo: el error de un `fetch` que falla arrastra la URL, y la URL del
 * geocodificador lleva el código postal dentro. Por eso aquí se cuenta *qué*
 * ha pasado y nunca *con qué dato*.
 */
export const registro = {
  aviso(mensaje: string): void {
    console.warn(`[cita-previa-sepe] ${mensaje}`)
  },
}
