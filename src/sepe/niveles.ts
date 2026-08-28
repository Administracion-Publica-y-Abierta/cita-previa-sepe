import type { SesionSepe } from './cliente'
import { opcionesDe, type Opcion } from './opciones'

/**
 * Los tres endpoints del árbol de trámites del SEPE, y todo lo que hay que
 * saber de su forma: cómo se llaman, qué parámetros piden y en qué orden se
 * bajan. Es al catálogo lo que `mapa.ts` es al buscador.
 *
 * Los parámetros no están adivinados: son los de las capturas, uno a uno. El
 * SEPE es tiquismiquis con ellos —`codigoEntidad` va vacío aquí y con valor en
 * el mapa, y el nivel 3 se pide con `nivel=2`— así que se dejan tal cual
 * aunque no se les vea el sentido.
 */

/** El nivel 3, el que trae el identificador que consume el mapa. */
export type Subtramite = Opcion

export interface Tramite {
  id: number
  nombre: string
  subtramites: Subtramite[]
}

/** Una rama raíz del árbol. En las capturas solo hay una: «PRESTACIONES». */
export interface Rama {
  id: number
  nombre: string
  tramites: Tramite[]
}

/** Niveles 1 y 2. Contesta JSON. */
const NIVELES = '/cita/cargaComboNivelesTramitesCPEntidad'

/** Nivel 3. Contesta HTML, y por eso hay que parsearlo. */
const SUBTRAMITES = '/cita/cargarComboGruposTramitesByNivel'

/**
 * Lo que el combo del nivel 3 lleva dentro cuando es el bueno: el `id` del
 * `<select>` que el SEPE pega en la página.
 *
 * Sirve para distinguirlo de la página de error que manda cuando está saturado,
 * que también es HTML y con un 200 delante. Si el SEPE renombrase el combo,
 * esto se convierte en un `sepe-no-responde` y no en un catálogo vacío: una
 * avería ruidosa antes que un árbol sin trámites que parece una respuesta.
 */
const COMBO_DEL_NIVEL_TRES = 'comboTiposServicios'

/** Lo que contestan los niveles 1 y 2. Solo se declara lo que se usa. */
interface RespuestaDeNiveles {
  listaNivelesTramites?: { idServicio: number; auxServicio?: string }[]
}

/**
 * El árbol entero de trámites de un código postal, descubierto en el momento.
 *
 * Se baja en serie y no en paralelo porque el freno los pondría en fila de
 * todas formas: son una petición por rama, una por trámite y una más para
 * arrancar, y lanzarlas a la vez solo cambiaría en qué orden esperan.
 */
export async function ramasDelCatalogo(sesion: SesionSepe, codigoPostal: string): Promise<Rama[]> {
  const ramas: Rama[] = []

  for (const raiz of await nivelesDe(sesion, codigoPostal, { nivel: 1, idsNiveles: '' })) {
    const tramites: Tramite[] = []

    for (const tramite of await nivelesDe(sesion, codigoPostal, { nivel: 2, idNivel: 0, idsNiveles: raiz.id })) {
      tramites.push({ ...tramite, subtramites: await subtramitesDe(sesion, codigoPostal, tramite.id) })
    }

    ramas.push({ ...raiz, tramites })
  }

  return ramas
}

/** Un nivel del árbol en JSON: el 1 sin `idsNiveles`, el 2 con la raíz de la que cuelga. */
async function nivelesDe(
  sesion: SesionSepe,
  codigoPostal: string,
  cual: { nivel: 1 | 2; idNivel?: number; idsNiveles: number | string },
): Promise<Opcion[]> {
  const respuesta = await sesion.json<RespuestaDeNiveles>(NIVELES, {
    codigoPostal,
    usoBloqueoIframe: 'false',
    origen: 'sepe',
    usaOrdenManual: 'true',
    codigoEntidad: '',
    ...cual,
  })

  // `auxServicio` es el nombre tal como lo llama el SEPE, que es justo por el
  // que quien pregunta va a reconocer el suyo cuando llegue a la sede. Los que
  // vengan sin nombre se caen: un identificador suelto no se le enseña a nadie.
  return (respuesta.listaNivelesTramites ?? [])
    .map((nivel) => ({ id: nivel.idServicio, nombre: nivel.auxServicio?.trim() ?? '' }))
    .filter((nivel) => nivel.nombre !== '')
}

/** El nivel 3 de un trámite. Es el que llega como HTML y hay que parsear. */
async function subtramitesDe(sesion: SesionSepe, codigoPostal: string, idTramite: number): Promise<Subtramite[]> {
  const html = await sesion.html(
    SUBTRAMITES,
    {
      codigoPostal,
      usoBloqueoIframe: 'false',
      // Sí, `nivel=2` para pedir el nivel 3: el combo de subtrámites cuelga del
      // trámite de nivel 2, y así es como lo pide la web del SEPE.
      nivel: 2,
      idNivel: 0,
      idsNiveles: idTramite,
      esServicio: 'false',
    },
    COMBO_DEL_NIVEL_TRES,
  )

  return opcionesDe(html)
}
