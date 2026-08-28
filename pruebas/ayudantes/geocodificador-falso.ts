import type { RespuestaAMano } from './fetch-falso'

/**
 * Respuestas del geocodificador puestas a mano.
 *
 * No hay grabaciones suyas: los fixtures son tráfico del SEPE y el
 * geocodificador es otro servicio. Los tres últimos casos —no lo conoce, está
 * caído, contesta sin coordenadas— son los que llevan al centroide provincial,
 * así que valen tanto como el bueno.
 *
 * El `endpoint` es el propio código postal porque el `fetch` falso llama
 * endpoint al último tramo de la ruta, y la API del geocodificador lleva ahí el
 * código postal. El porqué de que eso no choque con la regla de este proyecto
 * está en `src/localizacion/geocodificador.ts`, donde se construye la URL.
 */
/** El geocodificador conoce el código postal y devuelve municipio y coordenadas. */
export function geocodificadorConoce(
  codigoPostal: string,
  lugar: { municipio: string; lat: number; lng: number },
): RespuestaAMano {
  return {
    endpoint: codigoPostal,
    tipoContenido: 'application/json',
    cuerpo: JSON.stringify({
      'post code': codigoPostal,
      country: 'Spain',
      'country abbreviation': 'ES',
      // Forma verificada contra el servicio real. Las coordenadas llegan como
      // cadenas. Se omiten `state` y `state abbreviation`, que existen pero
      // traen la comunidad autónoma y no la provincia: no se leen.
      places: [
        {
          'place name': lugar.municipio,
          longitude: String(lugar.lng),
          latitude: String(lugar.lat),
        },
      ],
    }),
  }
}

/** El geocodificador no tiene ese código postal: contesta 404 con el cuerpo vacío. */
export function geocodificadorNoConoce(codigoPostal: string): RespuestaAMano {
  return {
    endpoint: codigoPostal,
    estado: 404,
    tipoContenido: 'application/json',
    cuerpo: '{}',
  }
}

/** El geocodificador está caído. */
export function geocodificadorAveriado(codigoPostal: string): RespuestaAMano {
  return {
    endpoint: codigoPostal,
    estado: 503,
    tipoContenido: 'text/html; charset=UTF-8',
    cuerpo: '<html>Service Unavailable</html>',
  }
}

/** El geocodificador contesta, pero sin ningún sitio dentro. */
export function geocodificadorSinCoordenadas(codigoPostal: string): RespuestaAMano {
  return {
    endpoint: codigoPostal,
    tipoContenido: 'application/json',
    cuerpo: JSON.stringify({ 'post code': codigoPostal, country: 'Spain', places: [] }),
  }
}
