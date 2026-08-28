/**
 * De qué tamaño es la pantalla, que jsdom no sabe: no trae `matchMedia`, y la
 * pantalla de resultados lo necesita para saber si caben las dos columnas.
 *
 * Por defecto se contesta que **no** caben. Lo que hay que probar es la
 * pantalla estrecha: es donde se va a usar esto y donde el mapa y la lista
 * tienen que convivir sin pelearse.
 */
export function pantalla({ dosColumnas }: { dosColumnas: boolean }): void {
  window.matchMedia = (consulta: string) =>
    ({
      matches: dosColumnas,
      media: consulta,
      addEventListener: () => {},
      removeEventListener: () => {},
      // Solo lo que la pantalla de resultados usa. Fingir el resto de
      // `MediaQueryList` sería fingir que se prueba algo más de lo que se
      // prueba, así que se dice aquí que la conversión es a propósito.
    }) as unknown as MediaQueryList
}
