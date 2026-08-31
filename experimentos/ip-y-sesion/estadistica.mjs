/**
 * Lo justo para no confundir ruido con hallazgo.
 *
 * Está aquí porque las dos mitades del experimento tienen el mismo peligro: a
 * la tasa medida —el SEPE contesta unas 3 de cada 8 veces con todo correcto—,
 * «el control contestó y el otro caso no» pasa por casualidad demasiado a
 * menudo. Sin esto, un 1/8 contra 0/8 se imprimiría con la misma seguridad que
 * un 5/13 contra 0/34, y son cosas distintas.
 */

function combinaciones(n, k) {
  if (k < 0 || k > n) return 0
  let salida = 1
  for (let i = 0; i < k; i += 1) salida = (salida * (n - i)) / (i + 1)
  return salida
}

/**
 * Fisher de una cola: la probabilidad de ver **al menos** esta diferencia a
 * favor del control si en realidad los dos casos fueran iguales.
 *
 * Una cola y no dos porque la hipótesis no es simétrica: lo que se quiere
 * saber es si el control contesta *más*, y que contestara menos no significaría
 * «el endpoint mira la sesión al revés», significaría que hay que repetir.
 */
export function fisherUnaCola(exitosA, totalA, exitosB, totalB) {
  const exitos = exitosA + exitosB
  const total = totalA + totalB
  if (!total || !exitos) return 1

  let p = 0
  for (let k = exitosA; k <= Math.min(exitos, totalA); k += 1) {
    p += (combinaciones(totalA, k) * combinaciones(totalB, exitos - k)) / combinaciones(total, exitos)
  }
  return p
}

/** El listón. 0,01 y no 0,05: esto decide arquitectura y coste, no un titular. */
export const LISTON = 0.01
