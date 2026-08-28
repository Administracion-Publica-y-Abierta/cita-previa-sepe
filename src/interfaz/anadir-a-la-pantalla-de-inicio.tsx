'use client'

import { useSyncExternalStore } from 'react'
import { hayQueExplicarComoSeAnade } from './el-movil'

/**
 * Los pasos para añadir esto a la pantalla de inicio de un iPhone.
 *
 * Sale solo donde hace falta —en Apple, y a quien no la tenga ya añadida—
 * porque en Android el navegador lo ofrece él solo y unos pasos que allí no se
 * llaman así son una pantalla más que leer.
 */

const TITULO = 'titulo-de-la-pantalla-de-inicio'

/** Desde qué móvil se mira no cambia mientras la página vive: se lee y ya. */
const SIN_CAMBIOS = () => () => {}

/**
 * El servidor no sabe desde dónde se mira esto, así que no dice nada. Como con
 * lo que recuerda el navegador: `useSyncExternalStore` convierte eso en un
 * segundo pintado en vez de en un desajuste de hidratación.
 */
const EN_EL_SERVIDOR = () => false

export function AnadirALaPantallaDeInicio() {
  const hayQueExplicarlo = useSyncExternalStore(
    SIN_CAMBIOS,
    hayQueExplicarComoSeAnade,
    EN_EL_SERVIDOR,
  )

  if (!hayQueExplicarlo) return null

  return (
    <section
      aria-labelledby={TITULO}
      className="flex flex-col gap-2 rounded-lg border-2 border-black/15 px-4 py-3 dark:border-white/20"
    >
      <h2 className="text-lg font-medium" id={TITULO}>
        Tenlo en la pantalla de inicio
      </h2>

      <p className="text-base">
        Pulsa <strong>Compartir</strong> —el cuadrado con la flecha— y luego{' '}
        <strong>Añadir a pantalla de inicio</strong>. Se abre a pantalla completa y, si te quedas sin
        cobertura, te enseña lo último que consultaste en vez de la página de error del navegador.
      </p>
    </section>
  )
}
