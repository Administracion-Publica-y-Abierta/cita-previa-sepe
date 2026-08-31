'use client'

import { useEffect, useRef } from 'react'
import { FiltroDeTramites } from './filtro-de-tramites'
import { AVISO_DEL_CAMPO, Hero } from './hero'
import { useLaBusqueda } from './la-busqueda'
import { LoEncontrado } from './lo-encontrado'
import { NINGUNO } from './lo-que-recuerda-el-navegador'
import { marcando } from './tramites-elegidos'

/**
 * La búsqueda, puesta en pantalla: el campo, los trámites que se pueden marcar
 * y lo que se ha encontrado.
 *
 * Es lo único de la portada que necesita navegador, y por eso las tres piezas
 * están aquí juntas: miran **el mismo** `useLaBusqueda()`, y las reglas que las
 * gobiernan —que la búsqueda es un bucle, que marcar un trámite no relanza nada
 * y que los filtros de la lista no cuestan ni una petición— viven allí y no
 * aquí. Esto es maquetación.
 */
export function LaPantalla() {
  const busqueda = useLaBusqueda()
  const { buscando, cambiarLoMarcado, elegidos, estado } = busqueda

  /**
   * Al pulsar el botón, la vista baja sola a los resultados.
   *
   * La pasada dura casi un minuto y lo que hay que ver es cómo se va llenando:
   * dejar a quien busca mirando el campo mientras la lista crece fuera de la
   * pantalla es la forma más fácil de que crea que no ha pasado nada.
   *
   * Se apunta al enviar y se cumple cuando la búsqueda **arranca de verdad**,
   * y por dos razones. Con un código postal mal escrito no arranca, y entonces
   * lo que hay que ver es el aviso pegado al campo. Y un enlace compartido
   * también busca solo: ese no baja, porque quien lo abre no ha pulsado nada y
   * una página que se mueve sola al cargar se lee como un fallo.
   */
  const losResultados = useRef<HTMLElement>(null)
  const pedidoAMano = useRef(false)

  useEffect(() => {
    if (!buscando) {
      // Un envío que no llega a arrancar ninguna búsqueda —el código postal no
      // vale— no puede dejar la intención de bajar apuntada para el siguiente
      // arranque, que puede no ser un envío: marcar un trámite que no se ha
      // consultado también sale al SEPE, y entonces la página daría un salto
      // que no ha pedido nadie.
      if (busqueda.aviso !== null) pedidoAMano.current = false
      return
    }

    if (!pedidoAMano.current) return
    pedidoAMano.current = false

    // Se comprueba antes de llamar: bajar es un adorno, y un navegador que no
    // sepa hacerlo no puede tumbar la pantalla que ya está buscando.
    const seccion = losResultados.current
    if (typeof seccion?.scrollIntoView === 'function') {
      seccion.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [buscando, busqueda.aviso])

  /**
   * Y el aviso del campo manda sobre la bajada.
   *
   * El código postal lo da por bueno el navegador y lo puede rechazar el
   * servidor, que es la autoridad: entonces la pantalla ya ha bajado a unos
   * resultados que se quedan vacíos, y el aviso —que está pegado al campo,
   * porque es donde está el arreglo— se queda arriba y fuera de la pantalla.
   * Quien mira se queda leyendo «Cuándo mirar» sin saber qué ha pasado.
   *
   * `block: 'nearest'` es lo que hace que esto no moleste: si el campo ya se
   * ve —lo normal, porque casi todos los avisos salen mientras se teclea— no
   * mueve nada.
   */
  useEffect(() => {
    if (busqueda.aviso === null) return

    const elAviso = document.getElementById(AVISO_DEL_CAMPO)
    if (typeof elAviso?.scrollIntoView === 'function') {
      elAviso.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [busqueda.aviso])

  return (
    <>
      <Hero
        alEnviar={(evento) => {
          pedidoAMano.current = true
          busqueda.alEnviar(evento)
        }}
        alEscribir={busqueda.alEscribir}
        aviso={busqueda.aviso}
        buscando={buscando}
        codigoPostal={busqueda.codigoPostal}
      />

      {/* En cuanto se sabe qué hay en la zona, y no antes: un selector con la
          lista vacía no filtra nada y es una pantalla más que entender. Marcar
          no es un paso previo a ver nada —sin marcar se enseñan todas—, así que
          esperar aquí al SEPE no le cuesta la espera a nadie.

          Los trámites vienen con la propia búsqueda: la cola es lo primero que
          manda la pasada, así que se puede empezar a marcar antes de que llegue
          una sola oficina y sin una segunda consulta al SEPE. */}
      {estado.cola.length > 0 ? (
        <FiltroDeTramites
          alMarcar={(id, marca) => cambiarLoMarcado(marcando(elegidos, id, marca))}
          alQuitarElFiltro={() => cambiarLoMarcado(NINGUNO)}
          elegidos={elegidos}
          tramites={estado.cola}
        />
      ) : (
        buscando && <LosTramitesQueVienen />
      )}

      <LoEncontrado busqueda={busqueda} seccion={losResultados} />
    </>
  )
}

/**
 * Que los trámites de la zona se están pidiendo.
 *
 * Se dice y no se calla porque el hueco donde van a salir es lo primero que hay
 * debajo del campo, y una franja vacía durante media espera se lee como que
 * falta algo. Y se dice **qué** se está pidiendo: descubrir el árbol de una
 * zona nueva son unos treinta segundos con el freno de por medio, y una
 * pantalla callada tanto rato parece colgada.
 *
 * Sin región viva a propósito: quien no ve la pantalla ya tiene el resumen de
 * la búsqueda anunciándose, y dos avisos a la vez para la misma espera son uno
 * de más.
 */
function LosTramitesQueVienen() {
  return (
    <section className="tramites">
      <div className="ancho">
        <p className="tramites__nota">
          Pidiéndole al SEPE qué trámites hay en tu zona. En cuanto lleguen podrás marcar los tuyos
          para quedarte solo con sus oficinas.
        </p>
      </div>
    </section>
  )
}
