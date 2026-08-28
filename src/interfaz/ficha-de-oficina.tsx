import type { Oficina } from '@/sepe/oficinas'
import { enFechaYHora, enKilometros } from './formato'
import { comoLlegar } from './mapa/como-llegar'

/**
 * Todo lo que hay que saber de una oficina para decidir si se va a ella.
 *
 * Es una sola pieza y se usa en los dos sitios —cada tarjeta de la lista y la
 * ficha que abre un punto del mapa— a propósito: si la ficha del mapa dijera
 * algo que la lista no dice, la lista dejaría de ser el equivalente completo
 * del mapa y quien no puede usarlo se quedaría con menos.
 */
export function FichaDeOficina({ oficina }: { oficina: Oficina }) {
  return (
    <>
      <h3 className="text-lg font-semibold">{oficina.nombre}</h3>

      <p className="mt-1 text-base">
        <Hueco primerHueco={oficina.primerHueco} />
      </p>

      <p className="mt-3 text-base">{oficina.direccion}</p>
      <p className="text-base opacity-80">A {enKilometros(oficina.km)}</p>
      <p className="text-base opacity-80">Horario de atención: {oficina.horarioAtencion}</p>

      <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-base">
        {/* Enlaces y no texto suelto: esto se va a mirar de pie en la calle,
            con el móvil, y llamar o ponerse en camino son los dos pasos
            siguientes naturales. */}
        <a className="underline" href={`tel:${oficina.telefono}`}>
          {oficina.telefono}
        </a>

        {/* Se abre fuera porque quien pulsa esto se va a la aplicación de
            mapas: si se abriera aquí, volver le costaría perder la búsqueda. */}
        <a className="underline" href={comoLlegar(oficina)} rel="noreferrer noopener" target="_blank">
          Cómo llegar
        </a>
      </p>
    </>
  )
}

/**
 * Con hueco o sin él, dicho con palabras.
 *
 * El color no puede ser lo único que los distinga: no lo ve quien no ve, y no
 * lo distingue buena parte de quien sí. Lo que separa las dos filas es la
 * primera palabra de la línea, y el color va encima. En el mapa el color sí es
 * lo que se ve de un vistazo, y por eso el mapa nunca va solo.
 */
function Hueco({ primerHueco }: { primerHueco: string | null }) {
  if (!primerHueco) {
    // No es lo mismo que no existir: esta oficina atiende, pero de este
    // trámite no tiene hora ahora mismo.
    return <span className="opacity-70">Sin hueco ahora mismo</span>
  }

  return (
    <span className="font-medium text-green-800 dark:text-green-300">
      Con hueco: <time dateTime={primerHueco}>{enFechaYHora(primerHueco)}</time>
    </span>
  )
}
