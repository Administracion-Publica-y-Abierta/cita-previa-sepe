'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react'
import { avisoDe, DIGITOS, soloDigitos } from './codigo-postal'
import {
  acabada,
  empezando,
  NADA_TODAVIA,
  oficinasDe,
  sumando,
  type LoQueVaLlegando,
} from './lo-que-va-llegando'
import {
  codigoPostalDeLaDireccion,
  ponerEnLaDireccion,
  recordarCodigoPostal,
  ultimoCodigoPostal,
} from './lo-que-recuerda-el-navegador'
import { seguirLaPasada } from './pasada'
import { Resultados } from './resultados'
import { loQueSeDice, seCuentaAlgo, tituloDe, type Percance } from './resumen'

/**
 * Un campo y un botón.
 *
 * Es la decisión de diseño de esta pantalla y conviene que esté escrita: quien
 * llega no debería tener que decidir nada antes de empezar. No se elige
 * trámite —el filtro llega en el issue #10, cuando ya hay una lista delante
 * que filtrar—, no se crea cuenta, y **no se pide el DNI**: nadie entrega un
 * dato antes de saber si le merece la pena.
 *
 * Y la búsqueda no es una espera: los trámites de la zona se consultan en cola
 * y **entran según llegan**. La lista y el mapa aparecen con el primero, y
 * mientras el resto viene se dice cuál se está consultando y cuánto falta.
 */

/** Los identificadores de los textos atados al campo. Fijos, para poder citarlos. */
const AVISO = 'aviso-del-codigo-postal'
const AYUDA = 'ayuda-del-codigo-postal'
const TITULO = 'titulo-de-los-resultados'

/**
 * Lo que se enseña cuando el servidor rechaza el código postal.
 *
 * Va pegado al campo y no en los resultados: ahí es donde está el arreglo. Es
 * un texto nuestro y no el del servidor, para no enseñar nunca algo que haya
 * llegado por la red.
 */
const LO_RECHAZA_EL_SERVIDOR =
  'Ese código postal no vale. Comprueba que son cinco dígitos de una provincia española.'

/**
 * Cómo se pinta lo que ha impedido contestar.
 *
 * Que se vea distinto del titular no es adorno: está medido que el mismo
 * trámite devuelve vacío y 46 oficinas con treinta segundos de diferencia, así
 * que «no hay huecos» y «el SEPE no está contestando» no se pueden parecer.
 * Quien lo lee no hace lo mismo en cada caso.
 */
const COMO_SE_PINTA: Record<Percance['tono'], string> = {
  averia: 'border-red-700 text-red-900 dark:border-red-400 dark:text-red-200',
  aviso: 'border-amber-600 text-amber-900 dark:border-amber-400 dark:text-amber-200',
}

/**
 * Ni el fragmento de la dirección ni lo que recuerda el navegador cambian
 * solos mientras la página vive: se leen y no hay a qué suscribirse.
 */
const SIN_CAMBIOS = () => () => {}

/**
 * Lo que ve el servidor al pintar esta página: nada. No tiene `window`, y
 * tampoco tendría por qué —lo que el navegador recuerda es del navegador—.
 * `useSyncExternalStore` es lo que convierte eso en un segundo pintado en vez
 * de en un desajuste de hidratación.
 */
const EN_EL_SERVIDOR = () => ''

export function Hero() {
  // La búsqueda que trae el enlace, y el último código postal usado. Se leen
  // en el primer pintado del navegador y no en un efecto: el campo tiene que
  // salir ya relleno, sin parpadear vacío primero.
  const compartido = useSyncExternalStore(SIN_CAMBIOS, codigoPostalDeLaDireccion, EN_EL_SERVIDOR)
  const propuesto = useSyncExternalStore(SIN_CAMBIOS, ultimoCodigoPostal, EN_EL_SERVIDOR)

  /** Lo tecleado, o `null` mientras no se haya tecleado nada. */
  const [escrito, setEscrito] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  /** Lo que va llegando de la última búsqueda, o `null` si no se ha lanzado ninguna. */
  const [llegando, setLlegando] = useState<LoQueVaLlegando | null>(null)

  // El `??` de fuera y no `||`: borrar el campo del todo es teclear, y
  // entonces tiene que quedarse vacío en vez de volver a proponer lo de antes.
  // Dentro sí es `||`, porque los dos son cadenas y se busca la primera con
  // algo dentro.
  const codigoPostal = escrito ?? (compartido || propuesto)

  // Si el enlace traía búsqueda y todavía no ha llegado nada, es que se está
  // buscando: la consulta sale en el mismo pintado, desde el efecto de abajo.
  const estado: LoQueVaLlegando = llegando ?? (compartido ? empezando(0) : NADA_TODAVIA)

  /**
   * Cuál es la búsqueda que vale. Solo la última: si se lanzan dos —la del
   * enlace y una a mano—, los eventos de las dos llegan mezclados y sin esto
   * la vieja podría pisar a la nueva y enseñar las oficinas de otro código
   * postal debajo del que se acaba de escribir.
   */
  const ultimaBusqueda = useRef(0)
  /** Con qué se abandona la que iba, para dejar de gastar peticiones al SEPE. */
  const enCurso = useRef<AbortController | null>(null)
  /**
   * El código postal de lo que se está mirando, que no siempre es el del campo:
   * quien teclea otro y no llega a buscarlo sigue viendo la lista de antes.
   *
   * Es una referencia y no un estado porque no se pinta: solo hace falta al
   * pulsar «Volver a comprobar», y guardarlo en un estado sería un pintado más
   * por cada búsqueda a cambio de nada.
   */
  const loBuscado = useRef<string | null>(null)

  const buscarOficinas = useCallback((codigoPostal: string) => {
    // La anterior se abandona de verdad y no solo se ignora: seguir
    // escuchándola es seguir gastando peticiones al SEPE de una búsqueda que ya
    // no le interesa a nadie, y el ritmo es de todo el servicio.
    enCurso.current?.abort()
    const mando = new AbortController()
    enCurso.current = mando

    const numero = (ultimaBusqueda.current += 1)
    const esLaBuena = () => numero === ultimaBusqueda.current
    loBuscado.current = codigoPostal
    setLlegando(empezando(numero))

    void seguirLaPasada(
      codigoPostal,
      (evento) => {
        if (esLaBuena()) setLlegando((antes) => sumando(antes ?? empezando(numero), evento))
      },
      mando.signal,
    ).then((fin) => {
      // `abandonada` no se pinta: es esta misma pantalla la que la ha cortado
      // para lanzar otra, y contarlo como un fallo sería mentir sobre la nueva.
      if (!esLaBuena() || fin === 'abandonada') return
      setLlegando((antes) => acabada(antes ?? empezando(numero), fin))
      if (fin === 'rechazado') setAviso(LO_RECHAZA_EL_SERVIDOR)
    })
  }, [])

  /**
   * Volver a preguntar por lo que se está mirando.
   *
   * Hace falta porque esta pantalla se deja abierta: quien la mira lleva un
   * rato con una lista delante y no tiene otra forma de saber si sigue valiendo.
   * Puede que el SEPE no se llegue a consultar —dentro del TTL se contesta con
   * lo guardado— y no pasa nada: la hora que se enseña es la de la consulta de
   * verdad, así que se ve si el dato ha cambiado de edad o no.
   */
  const volverAComprobar = useCallback(() => {
    if (loBuscado.current) buscarOficinas(loBuscado.current)
  }, [buscarOficinas])

  // Un enlace compartido enseña la misma búsqueda: se busca solo. Lo que
  // recuerda el navegador solo se propone, porque no lo ha pedido nadie ahora
  // y salir al SEPE cuesta lo que cuesta.
  //
  // El cerrojo se echa al primer pintado y no solo cuando hay algo que buscar:
  // al buscar se escribe la búsqueda en el fragmento, así que `compartido`
  // cambia y este efecto se vuelve a disparar. Sin echarlo antes, cada
  // búsqueda hecha a mano lanzaría otra igual detrás. Y hace falta además
  // porque en desarrollo React monta dos veces: una consulta de estas son diez
  // peticiones al SEPE con el freno de 2,5 s por medio, y duplicarlas es justo
  // lo que `CONTRIBUTING.md` prohíbe.
  const yaArrancado = useRef(false)
  useEffect(() => {
    if (yaArrancado.current) return
    yaArrancado.current = true
    if (!compartido) return

    // El que llega por enlace también es el último usado: si no se recordara,
    // quien entra siempre por su marcador nunca vería el campo relleno.
    recordarCodigoPostal(compartido)

    buscarOficinas(compartido)
  }, [compartido, buscarOficinas])

  function alEscribir(tecleado: string): void {
    const limpio = soloDigitos(tecleado)
    setEscrito(limpio)

    // Se avisa en el momento, pero solo cuando ya se puede saber: con los
    // cinco dígitos puestos. Decirle «faltan dígitos» a quien va por el
    // segundo es regañar a alguien que lo está haciendo bien.
    setAviso(limpio.length === DIGITOS ? avisoDe(limpio) : null)
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()

    const problema = avisoDe(codigoPostal)
    if (problema) {
      setAviso(problema)
      return
    }

    recordarCodigoPostal(codigoPostal)
    ponerEnLaDireccion(codigoPostal)

    setAviso(null)
    buscarOficinas(codigoPostal)
  }

  // Se funden una vez por evento y no en cada pintado: la lista es la misma
  // mientras no llegue nada, y darle al mapa una lista nueva cada vez que se
  // teclea en el campo es hacerle rehacer sus puntos por nada.
  const oficinas = useMemo(() => oficinasDe(estado), [estado])
  const dicho = loQueSeDice(estado, oficinas)
  const hayTitulo = seCuentaAlgo(estado)

  return (
    <>
      {/* `noValidate` para que el aviso sea el nuestro y no el globo del
          navegador, que ni se puede redactar ni lo lee un lector de pantalla
          con la misma fiabilidad. */}
      <form className="mx-auto flex w-full max-w-3xl flex-col gap-3" noValidate onSubmit={alEnviar}>
        <label className="text-lg font-medium" htmlFor="codigo-postal">
          Código postal
        </label>

        <div className="flex flex-wrap items-start gap-3">
          <input
            aria-describedby={`${AYUDA} ${AVISO}`}
            aria-invalid={aviso !== null}
            autoComplete="postal-code"
            className="w-40 rounded-lg border-2 border-black/30 px-4 py-3 text-2xl tracking-widest tabular-nums dark:border-white/30"
            id="codigo-postal"
            // `inputMode` y no `type="number"`: en el móvil saca el teclado
            // numérico igual, y sin la rueda ni los ceros de delante que se
            // comen los campos numéricos —«08401» empieza por cero—.
            inputMode="numeric"
            name="cp"
            onChange={(evento) => alEscribir(evento.target.value)}
            placeholder="08401"
            value={codigoPostal}
          />

          <button
            className="rounded-lg bg-foreground px-6 py-3 text-lg font-medium text-background disabled:opacity-60"
            disabled={estado.fase === 'buscando'}
            type="submit"
          >
            Comprobar horas
          </button>
        </div>

        <p className="text-base opacity-70" id={AYUDA}>
          Cinco dígitos. No hace falta nada más: ni DNI, ni cuenta, ni correo.
        </p>

        {/* Aparece solo cuando hay algo que decir: un `alert` que nace con el
            aviso dentro es el que los lectores de pantalla anuncian. */}
        {aviso !== null && (
          <p className="text-base font-medium text-red-800 dark:text-red-300" id={AVISO} role="alert">
            {aviso}
          </p>
        )}
      </form>

      {/* El nombre de la región va con su encabezado: sin él, `aria-labelledby`
          apuntaría a un identificador que no existe y la sección se quedaría
          sin nombre en vez de sin encabezado. */}
      <section aria-labelledby={hayTitulo ? TITULO : undefined} className="flex w-full flex-col gap-4">
        {hayTitulo && (
          <h2 className="text-2xl font-semibold" id={TITULO}>
            {tituloDe(estado)}
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
        */}
        <p className="text-lg" role="status">
          {dicho.resumen}
        </p>

        {/* Aparte del titular y con `alert`, que es lo que un lector de
            pantalla anuncia interrumpiendo: lo que no se ha podido preguntar
            no puede leerse como un resultado con cero huecos. */}
        {dicho.percance && (
          <p
            className={`rounded-lg border-2 px-4 py-3 text-lg font-medium ${COMO_SE_PINTA[dicho.percance.tono]}`}
            role="alert"
          >
            {dicho.percance.texto}
          </p>
        )}

        {/* De cuándo es lo que se está mirando, y cómo pedir que se mire otra
            vez. Van juntos porque es la misma pregunta: ¿esto sigue valiendo? */}
        {hayTitulo && (
          <div className="flex flex-wrap items-center gap-3">
            {dicho.frescura && (
              <p
                className={
                  dicho.frescura.viejo
                    ? 'text-base font-medium text-amber-900 dark:text-amber-200'
                    : 'text-base opacity-70'
                }
              >
                {dicho.frescura.texto}
              </p>
            )}

            <button
              className="rounded-lg border-2 border-black/30 px-4 py-2 text-base font-medium disabled:opacity-60 dark:border-white/30"
              disabled={estado.fase === 'buscando'}
              onClick={volverAComprobar}
              type="button"
            >
              Volver a comprobar
            </button>
          </div>
        )}

        {/* En cuanto hay una oficina se enseña, sin esperar a que termine la
            pasada: eso es lo que hace que el mapa salga con el primer trámite
            en vez de a los cuarenta y cuatro segundos. */}
        {oficinas.length > 0 && (
          <>
            {estado.localizacion?.precision === 'aproximada-provincial' && (
              <p className="text-base opacity-70">
                No hemos podido situar ese código postal con exactitud: las distancias están medidas desde el
                centro de {estado.localizacion.provincia} y pueden fallar por decenas de kilómetros.
              </p>
            )}
            <Resultados
              busqueda={estado.busqueda}
              localizacion={estado.localizacion}
              oficinas={oficinas}
            />
          </>
        )}
      </section>
    </>
  )
}
