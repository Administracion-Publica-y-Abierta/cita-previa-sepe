'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { Localizacion } from '@/localizacion/geocodificador'
import { FichaDeOficina } from './ficha-de-oficina'
import { idDeLaTarjeta, ListaDeOficinas } from './lista-de-oficinas'
import type { OficinaConSuTramite } from './lo-que-va-llegando'
import { Mapa } from './mapa/mapa'
import { dondeMarcarElCodigoPostal } from './mapa/puntos'

/**
 * El resultado, mirado de las dos maneras a la vez.
 *
 * Quien decide qué oficina está señalada y cuál está abierta es esta pieza y
 * no el mapa: así la sincronía entre lista y mapa va en los dos sentidos sin
 * que ninguno de los dos tenga que saber del otro.
 *
 * En escritorio caben las dos columnas y el mapa se queda pegado al hacer
 * scroll. En el móvil no caben: se enseña la lista y el mapa se abre a
 * pantalla completa cuando se pide, porque esta web se va a usar de pie en la
 * calle y media pantalla de mapa no sirve para nada.
 */
export function Resultados({
  oficinas,
  localizacion,
  busqueda,
}: {
  oficinas: OficinaConSuTramite[]
  localizacion: Localizacion | null
  /** Cambia con cada búsqueda nueva; no con cada trámite que entra. */
  busqueda: number
}) {
  /** Por la que se está pasando, con el ratón o con el foco. */
  const [senalada, setSenalada] = useState<number | null>(null)
  /** La que se ha pulsado en el mapa, y de la que se enseña la ficha. */
  const [elegida, setElegida] = useState<number | null>(null)
  const [mapaAbierto, setMapaAbierto] = useState(false)

  // El mapa se monta cuando se va a ver, y no antes: son casi mil kilobytes de
  // JavaScript más las teselas, y en el móvil la lista es lo que se enseña
  // primero. Una vez pedido se queda montado —cerrarlo y volver a abrirlo no
  // puede costar otra descarga— y en escritorio se monta de entrada, porque
  // ahí el mapa está a la vista desde el principio.
  const enEscritorio = useSyncExternalStore(alCambiarDeAncho, esPantallaAncha, EN_EL_SERVIDOR)
  const [mapaPedido, setMapaPedido] = useState(false)
  const hayMapa = enEscritorio || mapaPedido

  const abrirElMapa = useCallback(() => {
    setMapaPedido(true)
    setMapaAbierto(true)
  }, [])

  // Se busca en la lista de ahora y no se guarda la oficina entera: así una
  // búsqueda nueva no puede dejar abierta la ficha de una oficina que ya no
  // está en el resultado.
  const laElegida = oficinas.find((oficina) => oficina.id === elegida) ?? null

  // Señalar y elegir se pintan igual: la oficina cuya ficha está abierta tiene
  // que verse en el mapa y en la lista, o al abrirla se pierde de vista cuál
  // de todos los puntos era.
  const marcada = senalada ?? elegida

  /**
   * Lo que señala el mapa se señala en la lista **y se trae a la vista**. Solo
   * en este sentido: si al pasar por una tarjeta la lista se moviera sola, se
   * escaparía de debajo del ratón de quien la está leyendo.
   */
  const senalarDesdeElMapa = useCallback((id: number | null) => {
    setSenalada(id)
    if (id !== null) document.getElementById(idDeLaTarjeta(id))?.scrollIntoView({ block: 'nearest' })
  }, [])

  // Escape cierra lo de encima: primero la ficha y después el mapa. Es lo que
  // intenta todo el mundo antes de buscar el botón, y con el mapa a pantalla
  // completa el botón puede estar debajo del teclado del móvil.
  useEffect(() => {
    if (!laElegida && !mapaAbierto) return

    function alPulsar(evento: KeyboardEvent): void {
      if (evento.key !== 'Escape') return
      if (laElegida) setElegida(null)
      else setMapaAbierto(false)
    }

    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [laElegida, mapaAbierto])

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      {/* Con el mapa ocupando la pantalla, la lista está debajo y no se ve:
          `inert` la saca del paso del teclado y del lector de pantalla, para
          que tabular desde el mapa no caiga en una lista invisible. En
          escritorio no se aplica nunca, porque ahí las dos se ven a la vez. */}
      <div className="flex flex-col gap-4" inert={mapaAbierto && !enEscritorio}>
        {/* Solo en el móvil: en escritorio el mapa ya está a la vista y un
            botón para enseñar lo que se está viendo sobra. */}
        <button
          className="rounded-lg border-2 border-black/30 px-4 py-3 text-lg font-medium lg:hidden dark:border-white/30"
          onClick={abrirElMapa}
          type="button"
        >
          Ver las oficinas en el mapa
        </button>

        <ListaDeOficinas alSenalar={setSenalada} oficinas={oficinas} senalada={marcada} />
      </div>

      <section
        aria-label="Mapa de las oficinas"
        className={
          mapaAbierto
            ? 'fixed inset-0 z-50 flex flex-col gap-3 bg-background p-4 lg:sticky lg:inset-auto lg:top-6 lg:z-auto lg:h-[70vh] lg:p-0'
            : 'hidden lg:sticky lg:top-6 lg:flex lg:h-[70vh] lg:flex-col lg:gap-3'
        }
      >
        {/* Lo primero que se lee al entrar en la región, y va antes del mapa a
            propósito: quien no puede usarlo se entera de que no se está
            perdiendo nada en vez de pelearse con un lienzo. */}
        <p className="sr-only">
          El mapa es otra forma de mirar el mismo resultado. La lista de oficinas tiene la misma
          información y se recorre con el teclado.
        </p>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
          {hayMapa && (
            <Mapa
              alElegir={setElegida}
              alSenalar={senalarDesdeElMapa}
              busqueda={busqueda}
              marcaDelCodigoPostal={dondeMarcarElCodigoPostal(localizacion)}
              oficinas={oficinas}
              pantallaCompleta={mapaAbierto}
              senalada={marcada}
            />
          )}

          {laElegida && (
            <div className="absolute inset-x-2 bottom-2 max-h-[70%] overflow-y-auto rounded-lg border border-black/10 bg-background p-4 shadow-lg dark:border-white/15">
              <button
                className="float-right ml-3 rounded px-2 py-1 text-base underline"
                onClick={() => setElegida(null)}
                type="button"
              >
                Cerrar la ficha
              </button>
              <FichaDeOficina oficina={laElegida} />
            </div>
          )}
        </div>

        {mapaAbierto && (
          <button
            className="rounded-lg border-2 border-black/30 px-4 py-3 text-lg font-medium lg:hidden dark:border-white/30"
            onClick={() => setMapaAbierto(false)}
            type="button"
          >
            Volver a la lista
          </button>
        )}
      </section>
    </div>
  )
}

/**
 * A partir de dónde caben las dos columnas. Es el `lg` de Tailwind escrito una
 * segunda vez, y no hay forma de evitarlo: la maquetación la decide el CSS y
 * el montaje del mapa lo decide React, y los dos tienen que estar de acuerdo.
 */
const DOS_COLUMNAS = '(min-width: 64rem)'

function esPantallaAncha(): boolean {
  return window.matchMedia(DOS_COLUMNAS).matches
}

function alCambiarDeAncho(avisar: () => void): () => void {
  const consulta = window.matchMedia(DOS_COLUMNAS)
  consulta.addEventListener('change', avisar)
  return () => consulta.removeEventListener('change', avisar)
}

/** En el servidor no hay ancho de pantalla, y lo estrecho es lo que menos daño hace. */
const EN_EL_SERVIDOR = () => false
