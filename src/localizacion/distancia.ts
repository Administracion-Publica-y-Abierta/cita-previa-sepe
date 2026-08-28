/** Un punto en el mapa. Es lo que devuelve la localización y lo que traen las oficinas. */
export interface Coordenadas {
  lat: number
  lng: number
}

/**
 * Radio medio de la Tierra. Con la esfera basta: el error frente al elipsoide
 * es del orden del 0,3%, y aquí la distancia sirve para ordenar oficinas y para
 * filtrar por "menos de tantos kilómetros", no para navegar.
 */
const RADIO_TERRESTRE_KM = 6371

function enRadianes(grados: number): number {
  return (grados * Math.PI) / 180
}

/**
 * Distancia sobre la superficie entre dos puntos, por la fórmula del haversine.
 *
 * Esta distancia es nuestra a propósito: el SEPE manda un `distanciaCP` en cada
 * oficina, pero está calculado respecto a las coordenadas que le mandamos en
 * *esa* petición. En cuanto una respuesta se sirva de la caché para otro código
 * postal, ese número sería la distancia de otra persona.
 *
 * Haversine y no el teorema del coseno esférico porque este último pierde toda
 * la precisión en distancias cortas —oficinas del mismo barrio— y llega a
 * devolver NaN cuando el redondeo saca el coseno de [-1, 1].
 */
export function distanciaEnKm(desde: Coordenadas, hasta: Coordenadas): number {
  const dLat = enRadianes(hasta.lat - desde.lat)
  const dLng = enRadianes(hasta.lng - desde.lng)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(enRadianes(desde.lat)) * Math.cos(enRadianes(hasta.lat)) * Math.sin(dLng / 2) ** 2

  // El `min` es el cinturón: en puntos casi iguales la raíz puede salir 1 +
  // épsilon y `asin` fuera de dominio devuelve NaN.
  return 2 * RADIO_TERRESTRE_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}
