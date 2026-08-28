/**
 * El enlace que saca a quien mira de esta web y lo mete en su aplicación de
 * mapas.
 *
 * Es el último paso del recorrido: ya ha elegido oficina y lo que quiere es
 * llegar. Por eso el enlace es `https` y no un esquema `geo:` —que en iOS no
 * abre nada— y por eso los dos que se usan son enlaces universales: si la
 * aplicación está instalada la abre, y si no, abre la web.
 */

/** Lo mínimo que hace falta para llevar a alguien hasta una oficina. */
export interface Destino {
  nombre: string
  lat: number
  lng: number
}

/** iPhone, iPad y Mac. Lo demás —Android, escritorio— va a Google Maps. */
const DE_APPLE = /iPhone|iPad|iPod|Macintosh/i

export function comoLlegar(destino: Destino, agente: string = agenteDeUsuario()): string {
  // Coordenadas y no la dirección escrita: la que manda el SEPE no lleva ni
  // municipio ni provincia —«AVDA. MARIE CURIE, 25-27»—, y buscarla tal cual
  // manda a quien llega a la calle de ese nombre de otra ciudad.
  const donde = `${destino.lat},${destino.lng}`

  if (DE_APPLE.test(agente)) {
    // El nombre solo como etiqueta del punto: quien manda es `ll`.
    return `https://maps.apple.com/?ll=${donde}&q=${encodeURIComponent(destino.nombre)}`
  }

  return `https://www.google.com/maps/search/?api=1&query=${donde}`
}

/** En el servidor no hay navegador, y lo que se pinte allí se corrige al hidratar. */
function agenteDeUsuario(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent
}
