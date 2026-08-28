import type { Reloj } from '@/nucleo/reloj'

export interface RelojFalso extends Reloj {
  /** Adelanta el reloj y despierta a quien estuviera esperando. */
  avanzar(milisegundos: number): Promise<void>
}

interface Espera {
  vence: number
  seguir: () => void
}

/** Deja correr las microtareas pendientes antes de seguir mirando el reloj. */
function cederElTurno(): Promise<void> {
  return new Promise((seguir) => setImmediate(seguir))
}

/**
 * Un reloj que solo avanza cuando el test lo dice.
 *
 * Sin esto, comprobar que entre dos peticiones al SEPE pasan 2,5 segundos
 * costaría 2,5 segundos por petición. La regla de no acelerar el ritmo es
 * innegociable en producción; aquí se respeta el ritmo y se falsifica el
 * tiempo, que no es lo mismo que saltárselo.
 */
export function crearRelojFalso(instanteInicial: number): RelojFalso {
  let instante = instanteInicial
  let esperas: Espera[] = []

  return {
    ahora: () => instante,

    esperar(milisegundos) {
      if (milisegundos <= 0) return Promise.resolve()
      return new Promise((seguir) => {
        esperas.push({ vence: instante + milisegundos, seguir })
      })
    },

    async avanzar(milisegundos) {
      const objetivo = instante + milisegundos

      // Se avanza saltando de vencimiento en vencimiento, y no de un golpe
      // hasta el final, porque una espera encadena la siguiente: el freno del
      // SEPE es precisamente esperar 2,5 s antes de cada petición. De un solo
      // salto, la segunda espera se registraría con el reloj ya adelantado, su
      // vencimiento quedaría en el futuro y no despertaría nunca; el test
      // pasaría creyendo que solo hubo una petición.
      for (;;) {
        const siguiente = esperas
          .filter((e) => e.vence <= objetivo)
          .sort((a, b) => a.vence - b.vence)[0]
        if (!siguiente) break

        instante = Math.max(instante, siguiente.vence)
        esperas = esperas.filter((e) => e !== siguiente)
        siguiente.seguir()
        await cederElTurno()
      }

      instante = objetivo
      await cederElTurno()
    },
  }
}
