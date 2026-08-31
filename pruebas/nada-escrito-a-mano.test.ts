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

describe('los trámites los dice el SEPE, no nosotros', () => {
  it('no hay ni un identificador numérico escrito en el código que se despliega', () => {
    // Cualquier clave que sea un identificador —`id`, `idTramite`,
    // `idGrupoServicio`, `idsNiveles`— con un número puesto a mano detrás. Los
    // que la aplicación usa de verdad llegan de la red y son variables.
    //
    // El cero se deja pasar y no es un agujero: en el protocolo del SEPE quiere
    // decir «ninguno» —`idNivel: 0` al pedir la raíz del árbol— y no identifica
    // a ningún trámite. Prohibirlo obligaría a escribirlo con un rodeo, que es
    // peor que tenerlo a la vista.
    const culpables = loQueSeDespliega().filter((fichero) =>
      /\bid\w*:\s*[1-9]/.test(readFileSync(fichero, 'utf8')),
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
