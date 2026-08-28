/**
 * El nivel 3 del árbol de trámites no viene en JSON como los otros dos: el SEPE
 * lo manda ya montado, un `<select>` con sus `<option>` dentro, tal como lo
 * pega su propia web en la página. Es el único sitio de este proyecto donde hay
 * que leer HTML, y también el que da el `idGrupoServicio` que consume el mapa,
 * así que se aísla aquí: es la pieza que se rompe primero si el SEPE toca su
 * plantilla, y así se rompe sola y con un test que lo dice.
 */

/** Un subtrámite del combo, con el nombre que el SEPE le pone. */
export interface Opcion {
  id: number
  nombre: string
}

/**
 * La etiqueta entera con sus atributos por un lado y su texto por otro. Los
 * atributos vienen repartidos en varias líneas y son media docena
 * (`data-esservicio`, `data-id-entidad-oficina`...), así que se cogen en bloque.
 */
const OPCION = /<option\b([^>]*)>([\s\S]*?)<\/option>/g

/**
 * El identificador, se escriba donde se escriba dentro de la etiqueta.
 *
 * Se busca dentro del bloque de atributos y no exigiéndole ser el primero: si el
 * SEPE los reordenase —que es cosa suya y no avisa—, un patrón que diera por
 * hecho el orden devolvería la lista vacía **sin decir nada**, y el árbol
 * saldría con trámites sin subtrámites y cara de estar completo. Es justo la
 * avería silenciosa que este módulo existe para no tener.
 *
 * Tiene que ser un número: el `<option value="">` del «--- Seleccionar ---» no
 * es un trámite y se queda fuera por aquí.
 */
const VALOR = /\bvalue\s*=\s*"(\d+)"/

/**
 * Las entidades que el SEPE usa de verdad en los nombres de sus trámites. La
 * lista es corta a propósito: lo que no esté se deja tal cual, que es menos
 * malo que borrarlo.
 */
const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  uuml: 'ü',
  ccedil: 'ç',
  agrave: 'à',
  egrave: 'è',
  igrave: 'ì',
  ograve: 'ò',
  ugrave: 'ù',
  Ccedil: 'Ç',
  Agrave: 'À',
  Egrave: 'È',
  Ograve: 'Ò',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  Ntilde: 'Ñ',
  Uuml: 'Ü',
  ordm: 'º',
  ordf: 'ª',
  iquest: '¿',
  iexcl: '¡',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  middot: '·',
  euro: '€',
}

const ENTIDAD = /&(#\d+|#[xX][0-9a-fA-F]+|\w+);/g

/**
 * Los subtrámites de un combo del SEPE.
 *
 * Las opciones sin nombre se caen: quien pregunta elige su trámite por el
 * nombre, y un identificador suelto no se le puede enseñar a nadie.
 */
export function opcionesDe(html: string): Opcion[] {
  return [...html.matchAll(OPCION)]
    .map(([, atributos, etiqueta]) => ({
      id: Number(VALOR.exec(atributos)?.[1]),
      nombre: comoSeLee(etiqueta),
    }))
    .filter((opcion) => Number.isFinite(opcion.id) && opcion.nombre !== '')
}

/**
 * El texto de una etiqueta tal como hay que enseñárselo a una persona.
 *
 * Dos arreglos, y los dos son del SEPE: escapa los acentos («Declaraci&oacute;n»)
 * y reparte saltos de línea y tabuladores dentro de la etiqueta según le sale
 * de la plantilla.
 */
function comoSeLee(etiqueta: string): string {
  return etiqueta
    .replace(ENTIDAD, (entera, cuerpo: string) => {
      if (cuerpo.startsWith('#')) {
        const punto = cuerpo[1] === 'x' || cuerpo[1] === 'X' ? parseInt(cuerpo.slice(2), 16) : Number(cuerpo.slice(1))
        return Number.isFinite(punto) && punto > 0 ? String.fromCodePoint(punto) : entera
      }
      return ENTIDADES[cuerpo] ?? entera
    })
    .replace(/\s+/g, ' ')
    .trim()
}
