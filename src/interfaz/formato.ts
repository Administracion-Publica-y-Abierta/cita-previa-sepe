/**
 * Cómo se leen en castellano los números y las horas que enseña la lista.
 *
 * Está aparte de los componentes porque son decisiones de idioma y no de
 * maquetación, y porque las dos tienen trampa: los kilómetros salen del
 * cálculo con seis decimales que no le dicen nada a nadie, y la hora del SEPE
 * no lleva zona.
 */

const KILOMETROS = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

/**
 * La hora a la que se consultó al SEPE. Solo hora y minuto: lo que se enseña
 * nunca tiene más de una hora —es lo que se conserva una respuesta buena— así
 * que la fecha no añadiría nada y sí ruido a una línea que se lee de paso.
 */
const HORA = new Intl.DateTimeFormat('es-ES', { hour: 'numeric', minute: '2-digit' })

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

/**
 * El instante en que se le preguntó al SEPE, en la hora de quien mira.
 *
 * Aquí sí hay que convertir de zona, al revés que con el primer hueco: esto es
 * un instante de verdad —cuándo salió la petición— y no una hora de pared. Se
 * enseña en la del navegador porque es la que quien mira puede comparar con su
 * reloj, que es justo para lo que sirve.
 */
export function enHoraDeConsulta(instante: number): string {
  return HORA.format(new Date(instante))
}

/**
 * Lo mismo, con el día entero.
 *
 * Existe para lo único que se enseña sin haberlo consultado ahora: lo que se
 * guardó en el navegador y se saca cuando no hay cobertura. Eso sí puede ser de
 * ayer, y «consultado a las 13:37» de un dato de ayer es una hora que engaña.
 */
export function enFechaYHoraDeConsulta(instante: number): string {
  return FECHA_Y_HORA.format(new Date(instante))
}
