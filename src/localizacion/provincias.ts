import type { Coordenadas } from './distancia'

export interface Provincia extends Coordenadas {
  nombre: string
}

/**
 * Las cincuenta y dos provincias por los dos primeros dígitos del código
 * postal, con un punto céntrico de cada una.
 *
 * Para qué: es la red de seguridad de la localización. Cuando el geocodificador
 * no reconoce un código postal, situar a quien pregunta en el centro de su
 * provincia le da una lista de oficinas con distancias aproximadas, que es
 * bastante mejor que no darle nada. La interfaz avisa de que son aproximadas.
 *
 * Sirve además de tabla de validación: un código postal de cinco dígitos cuyos
 * dos primeros no estén aquí no es español, y eso se ve sin salir a la red.
 *
 * Las coordenadas son las de la capital de provincia y vienen del prototipo de
 * `old/`, donde llevan meses dando resultados razonables.
 */
const PROVINCIAS: Record<string, Provincia> = {
  '01': { nombre: 'Álava', lat: 42.8467, lng: -2.6716 },
  '02': { nombre: 'Albacete', lat: 38.9943, lng: -1.8585 },
  '03': { nombre: 'Alicante', lat: 38.3452, lng: -0.481 },
  '04': { nombre: 'Almería', lat: 36.834, lng: -2.4637 },
  '05': { nombre: 'Ávila', lat: 40.6565, lng: -4.6818 },
  '06': { nombre: 'Badajoz', lat: 38.8794, lng: -6.9707 },
  '07': { nombre: 'Illes Balears', lat: 39.5696, lng: 2.6502 },
  '08': { nombre: 'Barcelona', lat: 41.3874, lng: 2.1686 },
  '09': { nombre: 'Burgos', lat: 42.3439, lng: -3.6969 },
  '10': { nombre: 'Cáceres', lat: 39.4753, lng: -6.3724 },
  '11': { nombre: 'Cádiz', lat: 36.5271, lng: -6.2886 },
  '12': { nombre: 'Castellón', lat: 39.9864, lng: -0.0513 },
  '13': { nombre: 'Ciudad Real', lat: 38.9848, lng: -3.9273 },
  '14': { nombre: 'Córdoba', lat: 37.8882, lng: -4.7794 },
  '15': { nombre: 'A Coruña', lat: 43.3623, lng: -8.4115 },
  '16': { nombre: 'Cuenca', lat: 40.0704, lng: -2.1374 },
  '17': { nombre: 'Girona', lat: 41.9794, lng: 2.8214 },
  '18': { nombre: 'Granada', lat: 37.1773, lng: -3.5986 },
  '19': { nombre: 'Guadalajara', lat: 40.632, lng: -3.1618 },
  '20': { nombre: 'Gipuzkoa', lat: 43.3183, lng: -1.9812 },
  '21': { nombre: 'Huelva', lat: 37.2614, lng: -6.9447 },
  '22': { nombre: 'Huesca', lat: 42.1401, lng: -0.4089 },
  '23': { nombre: 'Jaén', lat: 37.7796, lng: -3.7849 },
  '24': { nombre: 'León', lat: 42.5987, lng: -5.5671 },
  '25': { nombre: 'Lleida', lat: 41.6176, lng: 0.62 },
  '26': { nombre: 'La Rioja', lat: 42.4627, lng: -2.445 },
  '27': { nombre: 'Lugo', lat: 43.0121, lng: -7.5559 },
  '28': { nombre: 'Madrid', lat: 40.4168, lng: -3.7038 },
  '29': { nombre: 'Málaga', lat: 36.7213, lng: -4.4214 },
  '30': { nombre: 'Murcia', lat: 37.9922, lng: -1.1307 },
  '31': { nombre: 'Navarra', lat: 42.8125, lng: -1.6458 },
  '32': { nombre: 'Ourense', lat: 42.3358, lng: -7.8639 },
  '33': { nombre: 'Asturias', lat: 43.3619, lng: -5.8494 },
  '34': { nombre: 'Palencia', lat: 42.0096, lng: -4.5288 },
  '35': { nombre: 'Las Palmas', lat: 28.1235, lng: -15.4363 },
  '36': { nombre: 'Pontevedra', lat: 42.431, lng: -8.6444 },
  '37': { nombre: 'Salamanca', lat: 40.9701, lng: -5.6635 },
  '38': { nombre: 'Santa Cruz de Tenerife', lat: 28.4636, lng: -16.2518 },
  '39': { nombre: 'Cantabria', lat: 43.4623, lng: -3.81 },
  '40': { nombre: 'Segovia', lat: 40.9429, lng: -4.1088 },
  '41': { nombre: 'Sevilla', lat: 37.3891, lng: -5.9845 },
  '42': { nombre: 'Soria', lat: 41.7665, lng: -2.479 },
  '43': { nombre: 'Tarragona', lat: 41.1189, lng: 1.2445 },
  '44': { nombre: 'Teruel', lat: 40.3456, lng: -1.1065 },
  '45': { nombre: 'Toledo', lat: 39.8628, lng: -4.0273 },
  '46': { nombre: 'Valencia', lat: 39.4699, lng: -0.3763 },
  '47': { nombre: 'Valladolid', lat: 41.6523, lng: -4.7245 },
  '48': { nombre: 'Bizkaia', lat: 43.263, lng: -2.935 },
  '49': { nombre: 'Zamora', lat: 41.5033, lng: -5.7446 },
  '50': { nombre: 'Zaragoza', lat: 41.6488, lng: -0.8891 },
  '51': { nombre: 'Ceuta', lat: 35.8894, lng: -5.3213 },
  '52': { nombre: 'Melilla', lat: 35.2923, lng: -2.9381 },
}

/**
 * La provincia de un código postal, o `null` si eso no es un código postal
 * español.
 *
 * Devolver `null` en vez de caer a Madrid, como hacía el prototipo, es
 * deliberado: situar a alguien en una provincia que no es la suya y no decirlo
 * es peor que no contestar, porque las distancias que vería serían creíbles y
 * estarían mal.
 */
export function provinciaDe(codigoPostal: string): Provincia | null {
  if (!/^\d{5}$/.test(codigoPostal)) return null
  return PROVINCIAS[codigoPostal.slice(0, 2)] ?? null
}
