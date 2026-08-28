/**
 * El punto de coordinación que vive **fuera del proceso**.
 *
 * Existe por el freno, no por la caché. En serverless no hay memoria
 * compartida entre invocaciones: un limitador guardado en variables del
 * proceso deja sencillamente de existir, y dos visitantes simultáneos lanzan
 * dos peticiones al SEPE en el mismo instante, sin los 2,5 segundos de
 * separación. "Sin base de datos" acabaría significando "sin freno", y eso
 * `CONTRIBUTING.md` no lo admite.
 *
 * Las cinco operaciones son las que Redis sabe hacer **de forma atómica sin
 * scripts**: cada una es un comando suyo. Es una restricción buscada, y es lo
 * que permite que la implementación en memoria y la de Redis se comporten
 * igual y se prueben con la misma batería.
 */
export interface Almacen {
  /** Lo guardado, o `null` si no está o ya ha caducado. */
  leer<T>(clave: string): Promise<T | null>

  /** Guarda con fecha de caducidad. Sobrescribe lo que hubiera. */
  guardar(clave: string, valor: unknown, vidaMs: number): Promise<void>

  /**
   * Reserva la clave **solo si nadie la tiene**, y contesta cuántos
   * milisegundos faltan para que se libere: `0` significa que es tuya.
   *
   * Es la operación sobre la que se sostienen el ritmo global y el
   * single-flight, y por eso tiene que ser atómica de verdad: en Redis es un
   * `SET NX PX`, que decide el servidor y no nosotros. Dos invocaciones que
   * pregunten a la vez no pueden ganar las dos.
   */
  reservar(clave: string, vidaMs: number): Promise<number>

  /** Suma uno y devuelve el resultado, sin leer-modificar-escribir por nuestra parte. */
  sumarUno(clave: string, vidaMs: number): Promise<number>

  /** Suelta una clave antes de que caduque. */
  olvidar(clave: string): Promise<void>
}
