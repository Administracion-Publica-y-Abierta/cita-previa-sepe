import type { Oficina } from '@/sepe/oficinas'
import { enFechaYHora, enKilometros } from './formato'

/**
 * Las oficinas, en una lista.
 *
 * Se construye desde el principio como **equivalente completo** de lo que
 * enseñará el mapa (issue #8) y no como su resumen: la web es para cualquier
 * ciudadano, y un mapa es exactamente lo que no puede usar quien navega con
 * teclado o con lector de pantalla. De ahí que sea una lista de verdad —`ul`,
 * `li`, un encabezado por oficina— y no una rejilla de cajas: así se recorre
 * saltando de oficina en oficina con los atajos del propio lector.
 */
export function ListaDeOficinas({ oficinas }: { oficinas: Oficina[] }) {
  return (
    <ul aria-label="Oficinas del SEPE, de la más cercana a la más lejana" className="flex flex-col gap-4">
      {oficinas.map((oficina) => (
        <li
          key={oficina.id}
          className="rounded-lg border border-black/10 p-5 dark:border-white/15"
        >
          <h3 className="text-lg font-semibold">{oficina.nombre}</h3>

          <p className="mt-1 text-base">
            <Hueco primerHueco={oficina.primerHueco} />
          </p>

          <p className="mt-3 text-base">{oficina.direccion}</p>
          <p className="text-base opacity-80">A {enKilometros(oficina.km)}</p>
          <p className="text-base opacity-80">Horario de atención: {oficina.horarioAtencion}</p>

          <p className="mt-2 text-base">
            {/* Enlace y no texto suelto: esto se va a mirar de pie en la calle,
                con el móvil, y llamar es el paso siguiente natural. */}
            <a className="underline" href={`tel:${oficina.telefono}`}>
              {oficina.telefono}
            </a>
          </p>
        </li>
      ))}
    </ul>
  )
}

/**
 * Con hueco o sin él, dicho con palabras.
 *
 * El color no puede ser lo único que los distinga: no lo ve quien no ve, y no
 * lo distingue buena parte de quien sí. Lo que separa las dos filas es la
 * primera palabra de la línea, y el color va encima.
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
