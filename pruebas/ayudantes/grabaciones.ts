import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Una respuesta del SEPE tal como se guardó: sin cabeceras, y por tanto sin `JSESSIONID`. */
export interface RespuestaGrabada {
  estado: number
  tipoContenido: string
  cuerpo: string
}

/** Una respuesta real del SEPE, sacada de una captura y ya anonimizada. */
export interface Grabacion {
  clave: string
  endpoint: string
  metodo: string
  /** Los parámetros que hacen a esta grabación distinta de las demás. */
  discriminadores: Record<string, string>
  capturaOrigen: string
  capturadoEn: string
  resumen: string
  respuesta: RespuestaGrabada
}

const DIRECTORIO = join(import.meta.dirname, '..', 'fixtures', 'sepe')

/** En el índice, `respuesta.cuerpo` es el nombre del fichero, no su contenido. */
interface Indice {
  grabaciones: Grabacion[]
}

let cache: Grabacion[] | undefined

/**
 * Las grabaciones disponibles, con el cuerpo ya leído de disco.
 *
 * Se leen una vez por proceso: son 70 KB y no cambian durante una tirada de
 * tests. Si hace falta regenerarlas: `npm run fixtures -- <ruta a los .har>`.
 */
export function cargarGrabaciones(): Grabacion[] {
  cache ??= (JSON.parse(readFileSync(join(DIRECTORIO, 'indice.json'), 'utf8')) as Indice).grabaciones.map(
    (g) => ({
      ...g,
      respuesta: { ...g.respuesta, cuerpo: readFileSync(join(DIRECTORIO, g.respuesta.cuerpo), 'utf8') },
    }),
  )
  return cache
}

/** Una grabación concreta, por si un test quiere comparar contra ella. */
export function grabacion(clave: string): Grabacion {
  const encontrada = cargarGrabaciones().find((g) => g.clave === clave)
  if (!encontrada) {
    throw new Error(
      `No hay ninguna grabación con la clave "${clave}". Disponibles:\n` +
        cargarGrabaciones()
          .map((g) => `  ${g.clave}  (${g.resumen})`)
          .join('\n'),
    )
  }
  return encontrada
}
