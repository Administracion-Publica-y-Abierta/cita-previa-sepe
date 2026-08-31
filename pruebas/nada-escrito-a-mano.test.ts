import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ficherosDe } from './ayudantes/ficheros'

/**
 * Ningún identificador de trámite del SEPE escrito a mano en `src/`.
 *
 * Es una comprobación de las que miran el código fuente y no la respuesta, del
 * mismo tipo que las de `carcasa.test.ts` y por el mismo motivo: **el
 * comportamiento que hay que impedir es el que todavía nadie ha escrito**.
 *
 * Lo que impide es concreto y ya ha pasado una vez. El prototipo de la ronda de
 * diseño traía veintitrés subtrámites del 08401 copiados a mano un martes de
 * agosto, porque necesitaba una lista antes de tener código postal. Funcionaba
 * en Granollers y se habría descubierto en Girona seis meses después: el SEPE
 * **cambia sus identificadores sin avisar y sirve un árbol distinto en cada
 * zona**, y `pasada.ts` filtra por identificador, así que lo que no cuadra no
 * falla —se cae en silencio y deja una lista de otra cosa, o de nada—.
 *
 * Por eso los trámites salen siempre de `POST /api/tramites`, que los descubre
 * enteros. Lo dice `src/sepe/catalogo.ts` desde el principio y lo repite
 * `CONTRIBUTING.md` en su lista de averías; esto es lo que hace que se note el
 * día que alguien vuelva a escribir uno para salir del paso.
 *
 * **Los tests sí pueden.** Un fixture con `{ id: 23, nombre: 'Voy a salir al
 * extranjero' }` no viaja al SEPE de nadie: es la respuesta que se le finge, y
 * escribirla a mano es justamente lo que se quiere poder hacer.
 */

const SRC = join(import.meta.dirname, '..', 'src')

/** Lo que se despliega: todo `src/` menos lo que solo corre en los tests. */
function loQueSeDespliega(): string[] {
  return ficherosDe(SRC).filter((fichero) => !/\.test\.tsx?$/.test(fichero))
}

/**
 * Las claves que **no** identifican un trámite y por eso pueden llevar un
 * número escrito.
 *
 * Es una lista corta y a propósito: la comprobación es ancha —cualquier clave
 * que empiece por `id`— porque lo que hay que cazar es lo que todavía nadie ha
 * escrito, y una lista de claves prohibidas se queda corta el día que alguien
 * invente una. Cuando aparezca un caso legítimo nuevo, lo que se hace es
 * añadirlo aquí con su razón, no ensanchar el agujero.
 *
 * - `idNivel`: en el árbol del SEPE es en qué nivel se está preguntando —1, 2,
 *   3—, no qué trámite. `0` es «ninguno», al pedir la raíz.
 * - `idTipoAtencionTR`: un modo de atención del protocolo de su mapa.
 */
const DEL_PROTOCOLO = ['idNivel', 'idTipoAtencionTR']

/** Una clave de identificador con un número puesto a mano detrás. */
function escritoAMano(codigo: string): boolean {
  return [...codigo.matchAll(/\b(id\w*):\s*(\d+)/g)].some(
    ([, clave]) => !DEL_PROTOCOLO.includes(clave!),
  )
}

describe('los trámites los dice el SEPE, no nosotros', () => {
  it('no hay ni un identificador numérico escrito en el código que se despliega', () => {
    const culpables = loQueSeDespliega().filter((fichero) =>
      escritoAMano(readFileSync(fichero, 'utf8')),
    )

    expect(culpables).toEqual([])
  })

  it('no hay ningún catálogo de subtrámites escrito a mano', () => {
    // La otra forma que tenía el del prototipo: un árbol de grupos con sus
    // subtrámites dentro, sin haberle preguntado nada a nadie.
    const culpables = loQueSeDespliega().filter((fichero) =>
      /subtramites:\s*\[/.test(readFileSync(fichero, 'utf8')),
    )

    expect(culpables).toEqual([])
  })
})
