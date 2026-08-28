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
 * Salen agrupados como los agrupa el SEPE y con sus mismos nombres, sin
 * reordenar ni reescribir nada: es la lista que va a volver a ver cuando vaya
 * a reservar, y reconocer el suyo ahí es justo lo que tiene que poder hacer.
 *
 * Casillas de verdad dentro de un `fieldset` con su `legend`, y no una rejilla
 * de botones: así se recorren con el teclado sin que nadie programe nada, y el
 * lector de pantalla dice el grupo antes de cada trámite —«Estoy cobrando…,
 * casilla, Me voy a jubilar»—, que es lo que lo hace reconocible sin ver la
 * pantalla.
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

  return (
    <section aria-labelledby={TITULO} className="flex w-full flex-col gap-4">
      <h2 className="text-2xl font-semibold" id={TITULO}>
        ¿Qué vas a hacer en el SEPE?
      </h2>

      <p className="text-base opacity-70">
        Marca los que se parezcan a lo tuyo: puedes marcar varios. Sin marcar ninguno se enseñan todos.
        Los nombres son los del SEPE, los mismos que verás al reservar.
      </p>

      <div className="flex flex-col gap-5">
        {grupos.map(({ grupo, tramites }) => (
          <fieldset className="flex flex-col gap-2" key={grupo.id}>
            <legend className="mb-1 text-lg font-medium">{grupo.nombre}</legend>

            {tramites.map((tramite) => (
              <label className="flex items-start gap-3 text-base" key={tramite.id}>
                <input
                  checked={elegidos.includes(tramite.id)}
                  className="mt-1 size-5 shrink-0"
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
        <button
          className="self-start rounded-lg border-2 border-black/30 px-4 py-2 text-base font-medium dark:border-white/30"
          onClick={alQuitarElFiltro}
          type="button"
        >
          Ver todos los trámites
        </button>
      )}
    </section>
  )
}
