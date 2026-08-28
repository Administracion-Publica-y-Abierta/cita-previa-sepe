import type { Oficina } from '@/sepe/oficinas'
import { FichaDeOficina } from './ficha-de-oficina'

/**
 * El identificador de la tarjeta de una oficina.
 *
 * Existe para poder traerla a la vista cuando se señala su punto en el mapa:
 * con veinte oficinas, resaltar una tarjeta que está diez pantallas más abajo
 * es resaltarla para nadie.
 */
export function idDeLaTarjeta(oficina: number): string {
  return `oficina-${oficina}`
}

/**
 * Las oficinas, en una lista.
 *
 * Se construye desde el principio como **equivalente completo** del mapa y no
 * como su resumen: la web es para cualquier ciudadano, y un mapa es
 * exactamente lo que no puede usar quien navega con teclado o con lector de
 * pantalla. De ahí que sea una lista de verdad —`ul`, `li`, un encabezado por
 * oficina— y no una rejilla de cajas: así se recorre saltando de oficina en
 * oficina con los atajos del propio lector.
 */
export function ListaDeOficinas({
  oficinas,
  senalada,
  alSenalar,
}: {
  oficinas: Oficina[]
  /** La oficina que está señalada ahora mismo, aquí y en el mapa. */
  senalada: number | null
  alSenalar: (id: number | null) => void
}) {
  return (
    <ul aria-label="Oficinas del SEPE, de la más cercana a la más lejana" className="flex flex-col gap-4">
      {oficinas.map((oficina) => (
        <li
          // Señalada con `aria-current` y no solo con un color: es el mismo
          // estado que resalta el punto en el mapa, y decirlo en el árbol de
          // accesibilidad no cuesta nada y lo hace comprobable.
          aria-current={senalada === oficina.id ? true : undefined}
          className={`rounded-lg border p-5 transition-colors ${
            senalada === oficina.id
              ? 'border-black/60 bg-black/[0.03] dark:border-white/60 dark:bg-white/[0.06]'
              : 'border-black/10 dark:border-white/15'
          }`}
          id={idDeLaTarjeta(oficina.id)}
          key={oficina.id}
          // El foco cuenta igual que el ratón: sin esto, relacionar la lista
          // con el mapa sería solo para quien puede señalar. `onFocus` en React
          // es `focusin`, así que sube desde el enlace que se acaba de enfocar.
          onBlur={() => alSenalar(null)}
          onFocus={() => alSenalar(oficina.id)}
          onMouseEnter={() => alSenalar(oficina.id)}
          onMouseLeave={() => alSenalar(null)}
        >
          <FichaDeOficina oficina={oficina} />
        </li>
      ))}
    </ul>
  )
}
