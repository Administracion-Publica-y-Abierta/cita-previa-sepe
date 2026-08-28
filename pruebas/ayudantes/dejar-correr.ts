import type { RelojFalso } from './reloj-falso'

/** A saltos cortos, para que las pausas del freno se despierten en su instante exacto. */
const PASO_MS = 500

/** Cinco minutos de reloj falso. Si una búsqueda no termina en eso, está colgada. */
const TOPE_DE_PASOS = 600

/**
 * Deja correr el reloj falso hasta que la tarea termina.
 *
 * Hace falta porque el freno son pausas **encadenadas**: la siguiente no
 * existe hasta que la anterior ha terminado y la petición ha ido y vuelto. Un
 * único `reloj.avanzar(N)` solo despierta a las que ya estaban registradas
 * cuando empezó a moverse, así que una búsqueda entera se quedaría a medias y
 * el test pasaría contando menos peticiones de las que hubo.
 *
 * El reloj no se acelera: las pausas siguen durando lo que duran, y el test
 * puede medirlas. Lo que no hace es gastarlas en tiempo real.
 */
export async function dejarCorrer<T>(reloj: RelojFalso, tarea: Promise<T>): Promise<T> {
  let viva = true
  const vigilada = tarea.finally(() => {
    viva = false
  })
  // Si la tarea falla, este `catch` evita el rechazo sin manejar mientras el
  // reloj sigue avanzando. Quien llama recibe `vigilada` y ve el fallo.
  vigilada.catch(() => {})

  for (let paso = 0; viva && paso < TOPE_DE_PASOS; paso += 1) await reloj.avanzar(PASO_MS)

  return vigilada
}
