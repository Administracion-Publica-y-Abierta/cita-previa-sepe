'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import type { GeoJSONSource, Map as MapaDeMapLibre } from 'maplibre-gl'
import type { Coordenadas } from '@/localizacion/distancia'
import type { Oficina } from '@/sepe/oficinas'
import {
  CAPA_GRUPOS,
  CAPA_OFICINAS,
  capasDelMapa,
  FUENTE_CODIGO_POSTAL,
  FUENTE_OFICINAS,
  FUENTE_RESALTADA,
  fuenteDeLaResaltada,
  fuenteDeOficinas,
  fuenteDelCodigoPostal,
  MAPA_DE_FONDO,
} from './estilo'
import { comoGeoJson, elGrupoDe, elPuntoDe, encuadreDe, puntosDe, type Grupo } from './puntos'
import { sePuedePintarUnMapa } from './webgl'

/**
 * El mapa de verdad: lo único de este proyecto que habla con MapLibre.
 *
 * Todo lo que se puede decidir sin una tarjeta gráfica delante está fuera
 * —`puntos.ts` decide qué se dibuja, `estilo.ts` cómo— y se prueba. Aquí solo
 * queda el pegamento: crear el mapa, meterle esos datos y traducir sus eventos
 * a los avisos que espera el resto de la pantalla.
 *
 * Si el navegador no puede pintar, este componente no pinta nada y no se
 * descarga la librería. No es un caso raro que se tolera: la lista de al lado
 * es el resultado completo, y quien llegue así no se queda sin nada.
 */

/** Donde `scripts/copiar-el-mapa.mjs` deja el worker de MapLibre. */
const WORKER = '/mapa/maplibre-gl-worker.mjs'

/** Solo si no se sabe dónde mirar, que es cuando no hay ni una oficina situada. */
const ESPANA = { lng: -3.7, lat: 40.2, zoom: 4.6 }

/**
 * Sitio alrededor de los puntos al encuadrar, y hasta dónde se deja acercar.
 * Sin el máximo, una sola oficina dejaría el mapa a ras de portal, que es
 * bonito y no dice nada de dónde cae respecto al resto.
 */
const ENCUADRE = { padding: 56, maxZoom: 14, duration: 0 }

export function Mapa({
  oficinas,
  marcaDelCodigoPostal,
  senalada,
  alSenalar,
  alElegir,
  pantallaCompleta,
  busqueda,
}: {
  oficinas: Oficina[]
  /** Dónde marcar el código postal buscado, o `null` si no se puede situar. */
  marcaDelCodigoPostal: Coordenadas | null
  senalada: number | null
  alSenalar: (id: number | null) => void
  alElegir: (id: number | null) => void
  /** Cambia cuando el mapa pasa a ocupar la pantalla, para que se remida. */
  pantallaCompleta: boolean
  /** Cambia con cada búsqueda nueva. Es lo que decide cuándo se reencuadra. */
  busqueda: number
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<MapaDeMapLibre | null>(null)
  /** Hasta que el estilo no está puesto no hay dónde meter las oficinas. */
  const [conCapas, setConCapas] = useState(false)

  // Los avisos van por referencia y no en las dependencias del efecto: el mapa
  // se crea una vez, y si dependiera de estas funciones habría que tirarlo y
  // volver a crearlo —con su descarga de teselas— en cada pintado.
  const avisos = useRef({ alSenalar, alElegir })
  useEffect(() => {
    avisos.current = { alSenalar, alElegir }
  })

  /** Lo que había cuando se montó, que es con lo que nace encuadrado. */
  const alNacer = useRef({ oficinas, marcaDelCodigoPostal })

  useEffect(() => {
    const donde = contenedor.current
    if (!donde || !sePuedePintarUnMapa()) return

    let vivo = true
    let creado: MapaDeMapLibre | null = null

    void (async () => {
      // Se trae aquí dentro y no arriba del fichero: MapLibre es casi un mega
      // de JavaScript, y esta web se va a abrir de pie en la calle con la
      // conexión que haya. Quien no llega a ver un mapa no lo descarga.
      const { Map, NavigationControl, setWorkerUrl } = await import('maplibre-gl')
      if (!vivo) return

      // MapLibre hace el trabajo pesado —descomprimir y trocear cada tesela—
      // en un worker, y decide dónde está su fichero con `import.meta.url`.
      // Dentro de un bundle eso apunta al bundle y no a `node_modules`, así
      // que el worker arranca, no encuentra su módulo y se muere sin decir
      // nada: el mapa se queda con el fondo pintado y ni una calle. Se le dice
      // dónde está, y la copia la deja ahí `scripts/copiar-el-mapa.mjs` antes
      // de cada build.
      setWorkerUrl(WORKER)

      const encuadre = encuadreDe(puntosDe(alNacer.current.oficinas), alNacer.current.marcaDelCodigoPostal)

      creado = new Map({
        container: donde,
        style: MAPA_DE_FONDO,
        // Nace ya encuadrado sobre el resultado en vez de nacer sobre España y
        // viajar hasta él. No es un atajo estético: las teselas del país
        // entero pesan lo que pesan, nadie las va a mirar, y esto se abre con
        // los datos del móvil.
        ...(encuadre
          ? { bounds: encuadre, fitBoundsOptions: ENCUADRE }
          : { center: [ESPANA.lng, ESPANA.lat] as [number, number], zoom: ESPANA.zoom }),
      })
      mapa.current = creado

      // Sin brújula: se gira sin querer con el pulgar y luego no hay forma de
      // volver al norte sin saber que se puede.
      creado.addControl(new NavigationControl({ showCompass: false }), 'top-right')

      // `style.load` y no `load`: el segundo espera además a que hayan llegado
      // las teselas del primer encuadre, así que una conexión lenta dejaría el
      // mapa sin oficinas hasta que terminara de pintarse el fondo.
      creado.once('style.load', () => {
        creado?.addSource(FUENTE_OFICINAS, fuenteDeOficinas(comoGeoJson([])))
        creado?.addSource(FUENTE_RESALTADA, fuenteDeLaResaltada(null))
        creado?.addSource(FUENTE_CODIGO_POSTAL, fuenteDelCodigoPostal(null))
        for (const capa of capasDelMapa()) creado?.addLayer(capa)
        setConCapas(true)
      })

      creado.on('click', CAPA_OFICINAS, (evento) => {
        const id = evento.features?.[0]?.properties?.id
        if (typeof id === 'number') avisos.current.alElegir(id)
      })

      // Pulsar en el mapa y no en un punto cierra la ficha: es el gesto que
      // todo el mundo intenta antes de buscar la equis.
      //
      // Se comprueba que las capas existen porque este manejador está vivo
      // desde antes de que el estilo cargue, y preguntar por una capa que aún
      // no está levanta un error en mitad de la pantalla.
      creado.on('click', (evento) => {
        if (!creado?.getLayer(CAPA_OFICINAS)) return
        const encima = creado.queryRenderedFeatures(evento.point, {
          layers: [CAPA_OFICINAS, CAPA_GRUPOS],
        })
        if (!encima.length) avisos.current.alElegir(null)
      })

      creado.on('click', CAPA_GRUPOS, (evento) => {
        void abrirElGrupo(creado, elGrupoDe(evento.features?.[0]))
      })

      creado.on('mouseenter', CAPA_OFICINAS, (evento) => {
        creado?.getCanvas().style.setProperty('cursor', 'pointer')
        const id = evento.features?.[0]?.properties?.id
        if (typeof id === 'number') avisos.current.alSenalar(id)
      })

      creado.on('mouseleave', CAPA_OFICINAS, () => {
        creado?.getCanvas().style.removeProperty('cursor')
        avisos.current.alSenalar(null)
      })
    })()

    return () => {
      vivo = false
      creado?.remove()
      mapa.current = null
    }
  }, [])

  /** La última búsqueda que se ha encuadrado, para no encuadrar dos veces la misma. */
  const encuadrada = useRef<number | null>(null)

  // Las oficinas y el código postal, cada vez que entra un trámite. Los puntos
  // se rehacen siempre —para eso llegan— pero el encuadre no.
  useEffect(() => {
    if (!conCapas || !mapa.current) return

    const puntos = puntosDe(oficinas)
    fuenteDe(mapa.current, FUENTE_OFICINAS)?.setData(comoGeoJson(puntos))
    fuenteDe(mapa.current, FUENTE_CODIGO_POSTAL)?.setData(fuenteDelCodigoPostal(marcaDelCodigoPostal).data)

    // El encuadre se rehace **una vez por búsqueda**. Quien busca no tiene que
    // ir a buscar sus resultados por el mapa, pero los trámites que entran
    // detrás son oficinas de la misma zona: mover la vista con cada uno le
    // quitaría el mapa de las manos a quien lo está mirando, que es justo lo
    // que tiene que poder hacer mientras el resto llega.
    if (encuadrada.current === busqueda) return

    const encuadre = encuadreDe(puntos, marcaDelCodigoPostal)
    if (!encuadre) return

    encuadrada.current = busqueda
    mapa.current.fitBounds(encuadre, ENCUADRE)
  }, [oficinas, marcaDelCodigoPostal, conCapas, busqueda])

  // La otra mitad de la sincronía con la lista: lo que se señala allí se
  // resalta aquí. De aquí a la lista va por `alSenalar`.
  useEffect(() => {
    if (!conCapas || !mapa.current) return
    fuenteDe(mapa.current, FUENTE_RESALTADA)?.setData(
      fuenteDeLaResaltada(elPuntoDe(puntosDe(oficinas), senalada)).data,
    )
  }, [senalada, oficinas, conCapas])

  // Al pasar a pantalla completa el contenedor cambia de tamaño sin que
  // MapLibre se entere, y el mapa se queda pintado del tamaño de antes.
  useEffect(() => {
    mapa.current?.resize()
  }, [pantallaCompleta])

  return <div className="mapa__lienzo-de-maplibre" ref={contenedor} />
}

/**
 * `getSource` no sabe qué tipo de fuente devuelve, y aquí sí se sabe: las dos
 * las hemos puesto nosotros y las dos son GeoJSON.
 */
function fuenteDe(mapa: MapaDeMapLibre, id: string): GeoJSONSource | null {
  return (mapa.getSource(id) as GeoJSONSource | undefined) ?? null
}

/** Pulsar un grupo se acerca hasta que se ve lo que tiene dentro. */
async function abrirElGrupo(mapa: MapaDeMapLibre | null, grupo: Grupo | null): Promise<void> {
  const fuente = mapa && grupo ? fuenteDe(mapa, FUENTE_OFICINAS) : null
  if (!mapa || !grupo || !fuente) return

  mapa.easeTo({ center: grupo.centro, zoom: await fuente.getClusterExpansionZoom(grupo.id) })
}
