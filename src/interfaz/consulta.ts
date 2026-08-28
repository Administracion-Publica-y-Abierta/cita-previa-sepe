import type { BusquedaDelPrimerTramite } from '@/sepe/primer-tramite'

/**
 * Preguntarle al servidor, y en qué queda.
 *
 * Está fuera del componente a propósito: así el efecto que lanza la consulta
 * no cambia estado por su cuenta —solo lo hace la respuesta, cuando llega— y
 * esto se puede leer sin saber nada de React.
 */

const RUTA = '/api/oficinas'

export type Estado =
  | { fase: 'inicial' }
  | { fase: 'buscando' }
  | { fase: 'hecho'; busqueda: BusquedaDelPrimerTramite }
  /** El servidor dice que ese código postal no vale. */
  | { fase: 'rechazado' }
  /** Ni siquiera se ha llegado a nuestro servidor: no hay red, o está caído. */
  | { fase: 'sin-conexion' }

export async function pedirOficinas(codigoPostal: string): Promise<Estado> {
  try {
    const respuesta = await fetch(RUTA, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // El código postal va en el cuerpo y no en la URL: el alojamiento
      // registra la URL entera de cada petición solo por existir.
      body: JSON.stringify({ cp: codigoPostal }),
    })

    if (!respuesta.ok) return { fase: 'rechazado' }
    return { fase: 'hecho', busqueda: (await respuesta.json()) as BusquedaDelPrimerTramite }
  } catch {
    return { fase: 'sin-conexion' }
  }
}
