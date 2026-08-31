import type { Ref } from 'react'
import { FiltrosDeLaLista } from './filtros-de-la-lista'
import type { Filtros } from './filtros'
import type { LaBusqueda } from './la-busqueda'
import { Resultados } from './resultados'

/**
 * Lo que se ha encontrado: el titular, lo que ha impedido contestar, de cuándo
 * es, los filtros y las oficinas.
 *
 * El reparto de esta pantalla es el que exige el issue #12 y no se puede
 * aplanar en un solo texto: **el titular** cuenta lo que hay y vive en una
 * región viva; **el percance** es lo que ha impedido contestar y se anuncia
 * como alerta; y **la frescura** dice de cuándo es el dato y va pegada al botón
 * de volver a comprobar, porque son la misma pregunta: ¿esto sigue valiendo?
 *
 * Aquí no se decide ni una palabra de eso. Lo que se dice lo dice `resumen.ts`
 * y lo que se filtra lo deciden las funciones puras de `filtros.ts`: esto es la
 * parte que se ve.
 */

/** El identificador del encabezado, para poder nombrar la región con él. */
const TITULO = 'titulo-de-los-resultados'

export function LoEncontrado({
  busqueda,
  seccion,
}: {
  busqueda: LaBusqueda
  /** Para poder bajar hasta aquí cuando alguien pulsa el botón. */
  seccion: Ref<HTMLElement>
}) {
  const {
    buscando,
    cambiarFiltros,
    dicho,
    filtros,
    hayTitulo,
    loQueSeMira,
    oficinas,
    referencia,
    titulo,
    visibles,
    volverAComprobar,
  } = busqueda

  return (
    // El nombre de la región va con su encabezado: sin él, `aria-labelledby`
    // apuntaría a un identificador que no existe y la sección se quedaría sin
    // nombre en vez de sin encabezado.
    // `data-hay` y no dejar de pintarla: la región viva de dentro tiene que
    // estar en el árbol **antes** de tener texto, porque una que nace ya con el
    // resumen dentro es la que algunos lectores de pantalla no llegan a
    // anunciar. Lo que se quita mientras no hay nada es el marco: el borde y el
    // aire de una sección vacía se leen como que la página está rota.
    <section
      aria-labelledby={hayTitulo ? TITULO : undefined}
      className="resultados"
      data-hay={hayTitulo ? 'si' : 'no'}
      ref={seccion}
    >
      <div className="ancho">
        <div className="resultados__cabeza">
          <div className="resultados__quien">
            {hayTitulo && (
              <h2 className="resultados__titulo" id={TITULO}>
                {/* El punto que late dice «esto se está llenando ahora mismo», y
                    por eso solo está mientras se llena. */}
                {buscando && <span aria-hidden className="punto" />}
                {titulo}
              </h2>
            )}

            {/*
              El resumen vive en una región viva y la lista no. Es a propósito:
              `status` se anuncia solo al cambiar y sin robar el foco, pero
              cuarenta y seis oficinas leídas de corrido no las aguanta nadie. Se
              anuncia el titular, y la lista se recorre cuando se quiera.

              Y está siempre en el árbol, aunque esté vacía: una región viva que
              nace ya con texto dentro es la que algunos lectores no llegan a
              anunciar.

              Lleva nombre porque en esta pantalla hay una segunda región viva
              —el contador de lo que dejan los filtros—, y dos regiones sin
              nombre son dos avisos que no se sabe de qué son.
            */}
            <p aria-label="Resumen de la búsqueda" className="resultados__resumen" role="status">
              {dicho.resumen}
            </p>
          </div>

          {/* De cuándo es lo que se está mirando, y cómo pedir que se mire otra
              vez. Van juntos porque es la misma pregunta. */}
          {hayTitulo && (
            <div className="frescura">
              {dicho.frescura && (
                <span className={dicho.frescura.viejo ? 'frescura--vieja' : undefined}>
                  {dicho.frescura.texto}
                </span>
              )}

              <button
                className="pastilla"
                disabled={buscando}
                onClick={volverAComprobar}
                type="button"
              >
                Volver a comprobar
              </button>
            </div>
          )}
        </div>

        {/* Aparte del titular y con `alert`, que es lo que un lector de pantalla
            anuncia interrumpiendo: lo que no se ha podido preguntar no puede
            leerse como un resultado con cero huecos.

            Con nombre, por lo mismo que las dos regiones vivas: el aviso pegado
            al campo también es un `alert`, y los dos salen a la vez en cuanto
            alguien teclea un código postal malo con una búsqueda fallida
            delante. Sin nombre no habría forma de pedir este. */}
        {dicho.percance && (
          <p
            aria-label="Lo que ha impedido contestar"
            className="percance"
            data-tono={dicho.percance.tono}
            role="alert"
          >
            {dicho.percance.texto}
          </p>
        )}

        {/* En cuanto hay una oficina se enseña, sin esperar a que termine la
            pasada: eso es lo que hace que el mapa salga con el primer trámite
            en vez de a los cuarenta y cuatro segundos. */}
        {oficinas.length > 0 && (
          <LaLista
            cambiarFiltros={cambiarFiltros}
            filtros={filtros}
            loQueSeMira={loQueSeMira}
            oficinas={oficinas}
            referencia={referencia}
            visibles={visibles}
          />
        )}
      </div>
    </section>
  )
}

/**
 * Las oficinas: el panel de filtros, la lista y el mapa.
 *
 * Va aparte porque solo existe cuando hay algo que enseñar, y meterlo dentro
 * del bloque de arriba llenaba de condiciones una parte que se lee de un
 * vistazo.
 */
function LaLista({
  cambiarFiltros,
  filtros,
  loQueSeMira,
  oficinas,
  referencia,
  visibles,
}: {
  cambiarFiltros: (filtros: Filtros) => void
  filtros: Filtros
  loQueSeMira: LaBusqueda['loQueSeMira']
  oficinas: LaBusqueda['oficinas']
  referencia: number | null
  visibles: LaBusqueda['visibles']
}) {
  return (
    <div className="columna">
      {loQueSeMira.localizacion?.precision === 'aproximada-provincial' && (
        <p className="aproximada">
          No hemos podido situar ese código postal con exactitud: las distancias están medidas desde
          el centro de {loQueSeMira.localizacion.provincia} y pueden fallar por decenas de
          kilómetros.
        </p>
      )}

      {/* El panel se pinta con **todas** las que hay y no con las que quedan: el
          contador cuenta sobre el total, y cuando los filtros dejan la lista a
          cero es justo cuando más falta hace que siga estando a la vista.

          Va encima de las dos columnas y no dentro de la de la lista: manda
          sobre lo que enseñan las dos, y meterlo en una daría a entender que el
          mapa enseña algo que la lista no. */}
      {referencia !== null && (
        <FiltrosDeLaLista
          alCambiar={cambiarFiltros}
          cuantasSeVen={visibles.length}
          filtros={filtros}
          oficinas={oficinas}
          referencia={referencia}
        />
      )}

      {/* La lista y el mapa enseñan lo mismo: los dos son la misma respuesta
          mirada de dos maneras, y un mapa con puntos que la lista no tiene
          dejaría de serlo. Se quedan puestos aunque los filtros no dejen
          ninguna: un mapa que desaparece al mover un control se lleva la vista
          de donde se estaba mirando, y lo que pasa ya lo dice el panel. */}
      <Resultados
        busqueda={loQueSeMira.busqueda}
        localizacion={loQueSeMira.localizacion}
        oficinas={visibles}
      />
    </div>
  )
}
