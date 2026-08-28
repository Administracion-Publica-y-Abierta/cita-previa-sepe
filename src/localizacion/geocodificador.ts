import type { Fetch } from '@/nucleo/dependencias'
import { registro } from '@/nucleo/registro'
import type { Coordenadas } from './distancia'
import { provinciaDe, type Provincia } from './provincias'

/** Dónde cae un código postal, y con cuánta confianza. */
export interface Localizacion extends Coordenadas {
  /** El municipio, cuando se sabe. `null` si solo se ha podido situar la provincia. */
  municipio: string | null
  provincia: string
  /**
   * Lo que la interfaz enseña. `aproximada-provincial` significa que las
   * coordenadas son el centro de la provincia y que las distancias que salgan
   * de ahí pueden estar a decenas de kilómetros de la verdad.
   */
  precision: 'exacta' | 'aproximada-provincial'
}

/** Cinco dígitos que no empiezan por una provincia española, o que ni siquiera son cinco dígitos. */
export class CodigoPostalInvalido extends Error {
  constructor() {
    // Sin el valor recibido: este mensaje puede acabar en un registro.
    super('El código postal recibido no es un código postal español.')
    this.name = 'CodigoPostalInvalido'
  }
}

export interface Geocodificador {
  localizar(codigoPostal: string): Promise<Localizacion>
}

/**
 * La provincia de un código postal, o el error si no lo es.
 *
 * Está aquí y no repetida en cada sitio que come código postal porque la
 * pregunta «¿esto vale?» tiene que tener una sola respuesta: el día que cambie
 * —un dígito más, un rango nuevo— cambia una vez y la heredan todos.
 */
export function exigirProvincia(codigoPostal: string): Provincia {
  const provincia = provinciaDe(codigoPostal)
  if (!provincia) throw new CodigoPostalInvalido()
  return provincia
}

const SERVICIO = 'https://api.zippopotam.us/es'

/**
 * Ocho segundos y se abandona. Es tiempo real y no el reloj inyectado a
 * propósito: esto no protege de una espera lógica sino de un socket colgado,
 * que es cosa del sistema operativo y no del reloj de los tests. Con el `fetch`
 * falso nunca llega a saltar.
 */
const ESPERA_MAXIMA_MS = 8000

/** Lo que contesta zippopotam. Solo se declara lo que se usa. */
interface RespuestaDelServicio {
  places?: { 'place name'?: string; latitude?: string; longitude?: string }[]
}

/**
 * Código postal → coordenadas, con el centroide de la provincia de reserva.
 *
 * Recibe su `fetch` por parámetro: es la costura, la misma que el cliente SEPE.
 * Todo lo demás —validación, parseo, la caída al centroide— se ejercita de
 * verdad en los tests.
 *
 * Que nunca falle por culpa del geocodificador es el punto: quien pregunta
 * prefiere una lista de oficinas con la distancia marcada como aproximada antes
 * que una pantalla de error por un servicio de terceros que hoy no contesta.
 */
export function crearGeocodificador({ fetch }: { fetch: Fetch }): Geocodificador {
  return {
    async localizar(codigoPostal: string): Promise<Localizacion> {
      const provincia = exigirProvincia(codigoPostal)

      const exacta = await preguntarAlServicio(fetch, codigoPostal)
      if (!exacta) {
        return {
          lat: provincia.lat,
          lng: provincia.lng,
          municipio: null,
          provincia: provincia.nombre,
          precision: 'aproximada-provincial',
        }
      }

      // La provincia sale siempre de los dos primeros dígitos y no de lo que
      // conteste el servicio: zippopotam devuelve la comunidad autónoma en
      // `state`, que para Cataluña o Andalucía no es la provincia.
      return { ...exacta, provincia: provincia.nombre, precision: 'exacta' }
    },
  }
}

type SitioEncontrado = Coordenadas & { municipio: string | null }

/**
 * El código postal viaja en la ruta porque la API del servicio es así. No choca
 * con la regla de este proyecto —el código postal nunca en la ruta— porque esa
 * regla protege *nuestras* URLs, que el alojamiento registra solo por existir.
 * Al geocodificador hay que darle el código postal de alguna forma.
 */
async function preguntarAlServicio(fetch: Fetch, codigoPostal: string): Promise<SitioEncontrado | null> {
  try {
    const respuesta = await fetch(`${SERVICIO}/${codigoPostal}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
    })
    if (!respuesta.ok) {
      registro.aviso('el geocodificador no reconoce un código postal: se sitúa por el centroide de la provincia')
      return null
    }

    const datos = (await respuesta.json()) as RespuestaDelServicio
    const sitio = datos.places?.[0]
    const lat = Number(sitio?.latitude)
    const lng = Number(sitio?.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      registro.aviso('el geocodificador ha contestado sin coordenadas: se sitúa por el centroide de la provincia')
      return null
    }

    return { lat, lng, municipio: sitio?.['place name']?.trim() || null }
  } catch {
    // El error no se imprime: su `message` puede arrastrar la URL, y la URL
    // lleva el código postal dentro.
    registro.aviso('el geocodificador no ha contestado: se sitúa por el centroide de la provincia')
    return null
  }
}
