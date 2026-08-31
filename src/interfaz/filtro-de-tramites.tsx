import { useMemo } from 'react'
import type { TramiteEnCola } from '@/sepe/cola'
import { agrupados } from './tramites-elegidos'

/**
 * Los trámites de la zona, para marcar los que se parezcan al tuyo.
 *
 * La decisión de diseño está en que se pueda marcar **más de uno**: mucha
 * gente no sabe cómo se llama su trámite, y obligarle a acertar a la primera
 * es lo que hace que hoy tenga que probar uno por uno en la sede. Aquí marca
 * los que le suenen y ve las oficinas de todos a la vez.
 *
 * Y en que **no sea un paso previo**: sin marcar ninguno se enseñan todos, así
 * que el hero sigue siendo un campo y un botón. Obligar a elegir metería la
 * espera del descubrimiento del árbol —unos treinta segundos la primera vez en
 * una zona— justo delante del botón, que es donde no se puede permitir.
 *
 * Salen agrupados como los agrupa el SEPE y con sus mismos nombres, sin
 * reordenar ni reescribir nada: es la lista que va a volver a ver cuando vaya
 * a reservar, y reconocer el suyo ahí es justo lo que tiene que poder hacer.
 *
 * Casillas de verdad dentro de un `fieldset` con su `legend`, y no una rejilla
 * de botones: así se recorren con el teclado sin que nadie programe nada, y el
 * lector de pantalla dice el grupo antes de cada trámite —«Estoy cobrando…,
 * casilla, Me voy a jubilar»—, que es lo que lo hace reconocible sin ver la
 * pantalla.
 *
 * Está siempre desplegado y no detrás de un desplegable, y esa es la otra
 * decisión: **lo marcado se ve sin abrir nada**, y de paso las casillas quedan
 * a un tabulador del botón de buscar. Un panel que esconde lo elegido convierte
 * una lista acotada en una lista corta, y no son lo mismo; por si acaso, el
 * recuento está también arriba, al lado del título.
 */

const TITULO = 'titulo-del-filtro-de-tramites'

export function FiltroDeTramites({
  tramites,
  elegidos,
  alMarcar,
  alQuitarElFiltro,
}: {
  /** Todos los trámites de la zona, en el orden del SEPE. */
  tramites: TramiteEnCola[]
  /** Los marcados. Vacío quiere decir que se miran todos. */
  elegidos: number[]
  alMarcar: (id: number, marcado: boolean) => void
  alQuitarElFiltro: () => void
}) {
  // Se reparte una vez por cola y no en cada pintado: la cola es la misma
  // mientras dure la búsqueda, y marcar una casilla no cambia los grupos.
  const grupos = useMemo(() => agrupados(tramites), [tramites])

  // Se cuenta lo marcado **que existe aquí**, y no lo que traiga la dirección:
  // un enlace compartido puede llegar con identificadores de otra zona —el SEPE
  // sirve un árbol distinto en cada una— y contarlos daría «20 de 9 marcados»
  // al lado de una lista vacía.
  const deEstaZona = tramites.filter((tramite) => elegidos.includes(tramite.id)).length

  return (
    <section aria-labelledby={TITULO} className="tramites">
      <div className="ancho">
        <div className="tramites__cabeza">
          <h2 id={TITULO}>¿Qué vas a hacer en el SEPE?</h2>

          {/* Cuántos hay marcados, siempre y sin tener que abrir nada. */}
          <span className="tramites__cuantos">{loMarcado(deEstaZona, tramites.length)}</span>
        </div>

        <p className="tramites__nota">
          Marca los que se parezcan a lo tuyo: puedes marcar varios. Sin marcar ninguno se enseñan
          todos. Los nombres son los del SEPE, los mismos que verás al reservar.
        </p>

        <div className="tramites__rejilla">
          {grupos.map(({ grupo, tramites }) => (
            <fieldset className="tramites__grupo" key={grupo.id}>
              <legend>{grupo.nombre}</legend>

              {tramites.map((tramite) => (
                <label className="casilla" key={tramite.id}>
                  <input
                    checked={elegidos.includes(tramite.id)}
                    onChange={(evento) => alMarcar(tramite.id, evento.target.checked)}
                    type="checkbox"
                  />
                  <span>{tramite.nombre}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>

        {/* Solo cuando hay algo que quitar: un botón que no hace nada es un
            botón que hay que probar para saber que no hace nada. */}
        {elegidos.length > 0 && (
          <p className="tramites__nota">
            <button className="pastilla" onClick={alQuitarElFiltro} type="button">
              Ver todos los trámites
            </button>
          </p>
        )}
      </div>
    </section>
  )
}

/**
 * Lo marcado, dicho en una pastilla.
 *
 * Con ninguno marcado se dice qué quiere decir eso —que se enseñan todos— y no
 * solo «0»: un cero al lado de un selector se lee como que no hay nada, que es
 * lo contrario de lo que pasa.
 */
function loMarcado(cuantos: number, deCuantos: number): string {
  if (cuantos > 0) return `${cuantos} de ${deCuantos} marcados`
  return deCuantos === 1
    ? 'Ninguno marcado: se enseña el único que hay'
    : `Ninguno marcado: se enseñan los ${deCuantos}`
}
