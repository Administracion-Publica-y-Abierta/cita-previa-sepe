import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Los ficheros de código que cuelgan de un directorio, en cualquier nivel.
 *
 * Lo usan las comprobaciones que miran el código fuente en vez de la respuesta
 * —las de protección de datos y las de la carcasa—, y está aquí porque son dos
 * y serían dos recorridos que hay que acordarse de cambiar a la vez.
 */
export function ficherosDe(raiz: string): string[] {
  return readdirSync(raiz, { withFileTypes: true }).flatMap((entrada) => {
    const camino = join(raiz, entrada.name)
    if (entrada.isDirectory()) return ficherosDe(camino)
    return /\.tsx?$/.test(entrada.name) ? [camino] : []
  })
}
