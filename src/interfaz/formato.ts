/**
 * Cómo se leen en castellano los números y las horas que enseña la lista.
 *
 * Está aparte de los componentes porque son decisiones de idioma y no de
 * maquetación, y porque las dos tienen trampa: los kilómetros salen del
 * cálculo con seis decimales que no le dicen nada a nadie, y la hora del SEPE
 * no lleva zona.
 */

const KILOMETROS = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

const FECHA_Y_HORA = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function enKilometros(km: number): string {
  return `${KILOMETROS.format(km)} km`
}

/**
 * El primer hueco, escrito entero.
 *
 * `2026-08-17T09:00:00` no lleva zona a propósito —es la hora de pared a la
 * que atiende esa oficina— y aquí se lee y se escribe con la del navegador, la
 * misma en las dos puntas. Así lo que se enseña son las nueve de la mañana
 * esté quien mira donde esté, que es lo que dice el SEPE.
 */
export function enFechaYHora(primerHueco: string): string {
  return FECHA_Y_HORA.format(new Date(primerHueco))
}
