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
import { FiltroDeTramites } from './filtro-de-tramites'
import { aplicando, SIN_FILTROS, type Filtros } from './filtros'
import { FiltrosDeLaLista } from './filtros-de-la-lista'
import { habiaCoberturaAlAbrir } from './cobertura'
import {
  acabada,
  deLaMemoria,
  empezando,
  loQueContesto,
  NADA_TODAVIA,
  oficinasDe,
  siguiendo,
  sumando,
  type LoQueVaLlegando,
} from './lo-que-va-llegando'
import {
  codigoPostalDeLaDireccion,
  filtrosDeLaDireccion,
  loGuardadoDeLaZona,
  loUltimoConsultado,
  NINGUNO,
  ponerEnLaDireccion,
  recordarCodigoPostal,
  recordarElResultado,
  tramitesDeLaDireccion,
  ultimoCodigoPostal,
} from './lo-que-recuerda-el-navegador'
import { seguirLaPasada } from './pasada'
import { Resultados } from './resultados'
import { loQueSeDice, seCuentaAlgo, tituloDe, type Percance } from './resumen'
import {
  loQueHayQuePedir,
  marcando,
  soloLoElegido,
  type PorQueSePregunta,
} from './tramites-elegidos'

/**
 * Un campo y un botón.
 *
 * Es la decisión de diseño de esta pantalla y conviene que esté escrita: quien
 * llega no debería tener que decidir nada antes de empezar. No se elige
 * trámite —el filtro sale **después**, cuando ya hay una lista delante que
 * filtrar—, no se crea cuenta, y **no se pide el DNI**: nadie entrega un dato
 * antes de saber si le merece la pena.
 *
 * Y la búsqueda no es una espera: los trámites de la zona se consultan en cola
 * y **entran según llegan**. La lista y el mapa aparecen con el primero, y
 * mientras el resto viene se dice cuál se está consultando y cuánto falta.
 *
 * Y una vez hay lista, se estrecha de dos maneras que no se parecen en nada:
 * por trámite —que puede costar una consulta al SEPE, porque puede haber algo
 * que todavía no se sepa— y por distancia, franja y fecha, que no cuesta
 * ninguna: eso ya está todo aquí y se resuelve con funciones puras.
 *
 * Marcar un trámite tampoco relanza nada. Si ya se sabe de él, solo cambia lo
 * que se mira; si no, se mete en la cola y sus oficinas se suman a las que hay
 * cuando lleguen. Por eso la búsqueda vive aquí como un bucle y no como una
 * llamada: mientras haya marcado algo que no se sepa, se vuelve a salir al
 * SEPE sin tirar lo traído.
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

/** Lo mismo para los trámites marcados: ninguno, y siempre el mismo array. */
const NINGUNO_EN_EL_SERVIDOR = () => NINGUNO

/** Y de los filtros de la lista, tampoco: sin filtros no se filtra. */
const SIN_FILTROS_EN_EL_SERVIDOR = () => SIN_FILTROS

/** Ni de lo que se guardó la última vez, que también es del navegador. */
const NADA_GUARDADO_EN_EL_SERVIDOR = () => null

/**
 * Y en el servidor se da por hecho que hay red: no hay ningún móvil al que
 * preguntarle, y lo que se pinta de más se corrige en el primer pintado del
 * navegador.
 */
const CON_RED_EN_EL_SERVIDOR = () => true

export function Hero() {
  // La búsqueda que trae el enlace, y el último código postal usado. Se leen
  // en el primer pintado del navegador y no en un efecto: el campo tiene que
  // salir ya relleno, sin parpadear vacío primero.
  const compartido = useSyncExternalStore(SIN_CAMBIOS, codigoPostalDeLaDireccion, EN_EL_SERVIDOR)
  const propuesto = useSyncExternalStore(SIN_CAMBIOS, ultimoCodigoPostal, EN_EL_SERVIDOR)
  const marcadosEnElEnlace = useSyncExternalStore(
    SIN_CAMBIOS,
    tramitesDeLaDireccion,
    NINGUNO_EN_EL_SERVIDOR,
  )
  // Y sus filtros, por lo mismo: quien abre una búsqueda compartida tiene que
  // ver la lista **ya filtrada**, y no la entera encogiéndose después.
  const filtrosDelEnlace = useSyncExternalStore(
    SIN_CAMBIOS,
    filtrosDeLaDireccion,
    SIN_FILTROS_EN_EL_SERVIDOR,
  )

  // Lo último que se consultó y si hay red, que es lo que decide si esto abre
  // con algo delante o con la pantalla vacía. Se leen aquí y no en un efecto por
  // lo mismo que el código postal: lo que hay que enseñar tiene que salir en el
  // primer pintado del navegador, no aparecer después.
  const guardado = useSyncExternalStore(
    SIN_CAMBIOS,
    loUltimoConsultado,
    NADA_GUARDADO_EN_EL_SERVIDOR,
  )
  const habiaRed = useSyncExternalStore(SIN_CAMBIOS, habiaCoberturaAlAbrir, CON_RED_EN_EL_SERVIDOR)

  /** Lo tecleado, o `null` mientras no se haya tecleado nada. */
  const [escrito, setEscrito] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  /** Lo que va llegando de la última búsqueda, o `null` si no se ha lanzado ninguna. */
  const [llegando, setLlegando] = useState<LoQueVaLlegando | null>(null)
  /** Lo marcado a mano, o `null` mientras no se haya tocado ninguna casilla. */
  const [marcado, setMarcado] = useState<number[] | null>(null)
  /** Los filtros de la lista tocados a mano, o `null` mientras valgan los del enlace. */
  const [tocados, setTocados] = useState<Filtros | null>(null)

  /**
   * Lo guardado, cuando toca enseñarlo: sin red, y siendo de la zona que se
   * está abriendo.
   *
   * Sin red no se sale a preguntar —no hay a dónde— y lo que quien mira
   * necesita ver es lo último que consultó, que es la mitad de para qué sirve
   * tener esto en la pantalla de inicio: abrirlo en el metro y ver algo en vez
   * de la página de error del navegador. Con red no se enseña: habiendo forma
   * de preguntar, una lista de hace un rato que nadie ha pedido solo confunde.
   */
  const recordado = habiaRed ? null : loGuardadoDeLaZona(guardado, compartido)

  // Se funde una vez y no en cada pintado: de aquí salen la lista y los puntos
  // del mapa, y darles un objeto nuevo cada vez que se teclea en el campo es
  // hacerles rehacer el trabajo por nada.
  const loRecordado = useMemo(() => (recordado ? deLaMemoria(recordado.estado) : null), [recordado])

  // El `??` de fuera y no `||`: borrar el campo del todo es teclear, y
  // entonces tiene que quedarse vacío en vez de volver a proponer lo de antes.
  // Dentro sí es `||`, porque los dos son cadenas y se busca la primera con
  // algo dentro.
  const codigoPostal = escrito ?? (compartido || recordado?.codigoPostal || propuesto)

  /** Los trámites marcados. Ninguno quiere decir que se miran todos. */
  const elegidos = marcado ?? recordado?.elegidos ?? marcadosEnElEnlace

  const filtros = tocados ?? filtrosDelEnlace

  // Si el enlace traía búsqueda y todavía no ha llegado nada, es que se está
  // buscando: la consulta sale en el mismo pintado, desde el efecto de abajo.
  // Salvo que no haya red, y entonces lo que hay es lo que se guardó.
  const estado: LoQueVaLlegando =
    llegando ?? loRecordado ?? (compartido ? empezando(0) : NADA_TODAVIA)

  /**
   * Cuál es la búsqueda que vale. Solo la última: si se lanzan dos —la del
   * enlace y una a mano—, los eventos de las dos llegan mezclados y sin esto
   * la vieja podría pisar a la nueva y enseñar las oficinas de otro código
   * postal debajo del que se acaba de escribir.
   */
  const ultimaBusqueda = useRef(0)
  /**
   * La pasada abierta: con qué se abandona, y qué trámites cubre —`'todos'`
   * cuando es la de la zona entera—. Lo segundo es lo que evita salir otra vez
   * al SEPE a por algo que ya viene de camino.
   */
  const enCurso = useRef<{ mando: AbortController; cubre: PorQueSePregunta } | null>(null)
  /** Lo marcado que espera a que acabe la pasada abierta para salir al SEPE. */
  const porPedir = useRef<number[]>([])
  /**
   * La zona que se está mirando, que no siempre es la del campo: se puede
   * teclear otro código postal sin pulsar el botón, y marcar un trámite
   * entonces no puede preguntar por una zona que nadie ha buscado ni escribirla
   * en la dirección.
   */
  const zona = useRef('')

  /**
   * La búsqueda entera: una pasada detrás de otra hasta que no quede nada
   * marcado por saber.
   *
   * Es un bucle y no una llamada porque marcar un trámite mientras corre no
   * puede relanzar nada: lo que se marca se apunta, y cuando la que va termina
   * se sale a por ello sin tocar lo que ya está en la lista.
   */
  const seguir = useCallback(async (codigoPostal: string, primeros: PorQueSePregunta, numero: number) => {
    const esLaBuena = () => numero === ultimaBusqueda.current
    let toca = primeros

    for (;;) {
      const mando = new AbortController()
      enCurso.current = { mando, cubre: toca }

      const fin = await seguirLaPasada(
        { codigoPostal, tramites: toca === 'todos' ? undefined : toca },
        (evento) => {
          if (esLaBuena()) setLlegando((antes) => sumando(antes ?? empezando(numero), evento))
        },
        mando.signal,
      )

      // `abandonada` no se pinta: es esta misma pantalla la que la ha cortado
      // para lanzar otra, y contarlo como un fallo sería mentir sobre la nueva.
      if (!esLaBuena() || fin === 'abandonada') return
      enCurso.current = null

      // Con el SEPE caído o el código postal rechazado no se sigue pidiendo:
      // encadenar peticiones a algo que no contesta no arregla nada.
      //
      // Y la cola se vacía al salir. Dejarla puesta la convertiría en una
      // promesa que ya no va a cumplir nadie: esos trámites cuentan luego como
      // «ya vienen de camino», así que no se pedirían nunca más y quien los
      // marcó los vería marcados y vacíos para siempre.
      if (fin !== 'terminada' || porPedir.current.length === 0) {
        porPedir.current = []

        // Quedarse sin red y no traer nada deja la pantalla peor que estaba: se
        // enseña lo guardado de esta zona, que es lo que quien pregunta tenía
        // delante hace un rato.
        const rescate =
          fin === 'sin-conexion' ? loGuardadoDeLaZona(loUltimoConsultado(), codigoPostal) : null
        setLlegando((antes) => {
          const final = acabada(antes ?? empezando(numero), fin)
          // Lo traído manda sobre lo guardado, aunque sea media lista: es de
          // ahora, y lo guardado no.
          return rescate && loQueContesto(final).length === 0 ? deLaMemoria(rescate.estado) : final
        })

        if (fin === 'rechazado') setAviso(LO_RECHAZA_EL_SERVIDOR)
        return
      }

      toca = porPedir.current
      porPedir.current = []
      setLlegando((antes) => siguiendo(antes ?? empezando(numero)))
    }
  }, [])

  /**
   * Una búsqueda nueva: la de otra zona, o la misma otra vez. Se tira lo de
   * antes, que era de otro sitio.
   *
   * Con trámites marcados se consultan **solo esos**. Un enlace compartido con
   * dos trámites elegidos no tiene por qué costar los nueve de la zona, y los
   * demás siguen a un clic de distancia.
   */
  const buscarOficinas = useCallback(
    (codigoPostal: string, tramites: number[]) => {
      // La anterior se abandona de verdad y no solo se ignora: seguir
      // escuchándola es seguir gastando peticiones al SEPE de una búsqueda que ya
      // no le interesa a nadie, y el ritmo es de todo el servicio.
      enCurso.current?.mando.abort()
      enCurso.current = null
      porPedir.current = []
      zona.current = codigoPostal

      const numero = (ultimaBusqueda.current += 1)
      setLlegando(empezando(numero))

      void seguir(codigoPostal, tramites.length > 0 ? tramites : 'todos', numero)
    },
    [seguir],
  )

  /**
   * Volver a preguntar por lo que se está mirando.
   *
   * Hace falta porque esta pantalla se deja abierta: quien la mira lleva un
   * rato con una lista delante y no tiene otra forma de saber si sigue valiendo.
   * Puede que el SEPE no se llegue a consultar —dentro del TTL se contesta con
   * lo guardado— y no pasa nada: la hora que se enseña es la de la consulta de
   * verdad, así que se ve si el dato ha cambiado de edad o no.
   *
   * Se vuelve a preguntar por la zona y por lo marcado, que es exactamente lo
   * que hay delante: ni por lo que haya quedado en el campo sin buscar, ni por
   * los trámites que ahora mismo no se están mirando.
   */
  const volverAComprobar = useCallback(() => {
    if (zona.current) buscarOficinas(zona.current, elegidos)
  }, [buscarOficinas, elegidos])

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

    // Con lo guardado delante no se sale a preguntar: no hay red, que es
    // justamente por lo que está delante. Lo que sí se apunta es qué zona se
    // está mirando, que es lo que hace falta para volver a comprobarla en
    // cuanto vuelva la cobertura.
    if (recordado) {
      zona.current = recordado.codigoPostal
      return
    }

    if (!compartido) return

    // El que llega por enlace también es el último usado: si no se recordara,
    // quien entra siempre por su marcador nunca vería el campo relleno.
    recordarCodigoPostal(compartido)

    // Con los trámites que traiga el enlace: quien lo comparte ya ha elegido,
    // y volver a consultar la zona entera sería gastarle al SEPE lo que nadie
    // ha pedido.
    buscarOficinas(compartido, marcadosEnElEnlace)
  }, [compartido, marcadosEnElEnlace, buscarOficinas, recordado])

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
    // Sin trámites marcados: los de la zona anterior no son estos, y arrastrar
    // sus identificadores dejaría una búsqueda nueva filtrada por algo que no
    // existe aquí.
    setMarcado(NINGUNO)
    // Los filtros de la lista sí se conservan: no son de esta zona ni de estos
    // trámites —«a menos de cinco kilómetros» quiere decir lo mismo en
    // cualquier código postal—, así que tirarlos sería deshacer algo que nadie
    // ha pedido deshacer.
    ponerEnLaDireccion(codigoPostal, NINGUNO, filtros)

    setAviso(null)
    buscarOficinas(codigoPostal, NINGUNO)
  }

  /**
   * Lo marcado ha cambiado: se apunta en la dirección y, si hay algo marcado
   * de lo que todavía no se sabe nada, se va a por ello.
   *
   * Lo que **no** se hace es relanzar la búsqueda. Lo que ya llegó se queda en
   * la lista aunque ahora no se mire, y por eso desmarcar no pierde nada y
   * volver a marcar no le cuesta al SEPE una segunda consulta.
   */
  function cambiarLoMarcado(nuevos: number[]): void {
    setMarcado(nuevos)
    ponerEnLaDireccion(zona.current, nuevos, filtros)

    // Lo que se desmarca antes de que le llegue el turno se cae de la cola: ya
    // no lo mira nadie, y una petición al SEPE que nadie va a leer es una
    // petición que le hemos quitado a otro.
    porPedir.current = porPedir.current.filter((id) => nuevos.includes(id))

    const abierta = enCurso.current
    const enCamino =
      abierta?.cubre === 'todos' ? 'todos' : [...(abierta?.cubre ?? []), ...porPedir.current]

    const hayQuePedir = loQueHayQuePedir(nuevos, estado, enCamino)
    if (hayQuePedir.length === 0) return

    // Con una pasada abierta se apunta y se espera: dos pasadas a la vez son
    // dos colas peleándose por las fichas del freno, y el ritmo con el SEPE es
    // de todo el servicio.
    if (abierta) {
      porPedir.current = [...porPedir.current, ...hayQuePedir]
      return
    }

    setLlegando((antes) => siguiendo(antes ?? empezando(ultimaBusqueda.current)))
    void seguir(zona.current, hayQuePedir, ultimaBusqueda.current)
  }

  /**
   * Lo mismo, visto solo por lo marcado. Es lo que se enseña de aquí abajo: el
   * filtro mira y no tira, así que `estado` sigue teniendo lo desmarcado
   * entero por si vuelve a marcarse.
   */
  const loQueSeMira = useMemo(() => soloLoElegido(estado, elegidos), [estado, elegidos])

  // Se funden una vez por evento y no en cada pintado: la lista es la misma
  // mientras no llegue nada, y darle al mapa una lista nueva cada vez que se
  // teclea en el campo es hacerle rehacer sus puntos por nada.
  const oficinas = useMemo(() => oficinasDe(loQueSeMira), [loQueSeMira])
  const hayTitulo = seCuentaAlgo(loQueSeMira)
  const dicho = loQueSeDice(loQueSeMira, oficinas)

  // Desde cuándo cuentan «hoy», «esta semana» y «este mes»: el instante con el
  // que el SEPE contestó estas horas, que lo trae el trámite. Llega con el
  // primero, o sea antes que cualquier oficina: mientras es `null` no hay nada
  // que filtrar.
  const referencia = loQueSeMira.consultadoEn

  // Filtrar y ordenar es una función pura sobre lo que ya ha llegado: ni una
  // petición. Aquí está la diferencia con el filtro de trámites, que sí puede
  // costar una consulta porque puede pedir algo que todavía no se sabe.
  const visibles = useMemo(
    () => (referencia === null ? oficinas : aplicando(oficinas, filtros, referencia)),
    [oficinas, filtros, referencia],
  )

  /**
   * Lo que se acaba de mirar se guarda en el navegador, para poder enseñarlo el
   * día que se abra esto sin cobertura.
   *
   * Se guarda al terminar y no según llega: son nueve escrituras de la lista
   * entera contra una, y a mitad de pasada lo guardado sería medio resultado.
   * Y no se vuelve a guardar lo que salió de aquí —`de-memoria`— porque sería
   * escribir encima lo mismo, con el riesgo de dejarlo peor si algo cambia.
   *
   * Los filtros de la lista no van aquí: son de quien mira y no del SEPE, ya
   * viven en la dirección, y guardarlos escondería oficinas al abrir sin red
   * sin que se viera por qué.
   */
  useEffect(() => {
    if (estado.fase === 'buscando' || estado.fase === 'de-memoria') return
    if (loQueContesto(estado).length === 0) return

    recordarElResultado({ codigoPostal: zona.current, elegidos, estado })
  }, [estado, elegidos])

  // Los filtros se escriben en la dirección según se tocan, para que el enlace
  // que hay en la barra sea siempre el de lo que se está viendo. La zona y no
  // el campo, por lo mismo que al marcar un trámite: se puede teclear otro
  // código postal sin pulsar el botón.
  function cambiarFiltros(nuevos: Filtros): void {
    setTocados(nuevos)
    if (zona.current) ponerEnLaDireccion(zona.current, elegidos, nuevos)
  }

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
          <p
            aria-label="Aviso del código postal"
            className="text-base font-medium text-red-800 dark:text-red-300"
            id={AVISO}
            role="alert"
          >
            {aviso}
          </p>
        )}
      </form>

      {/* En cuanto se sabe qué hay en la zona, y no antes: un filtro con la
          lista vacía no filtra nada y es una pantalla más que entender. */}
      {estado.cola.length > 0 && (
        <FiltroDeTramites
          alMarcar={(id, marca) => cambiarLoMarcado(marcando(elegidos, id, marca))}
          alQuitarElFiltro={() => cambiarLoMarcado(NINGUNO)}
          elegidos={elegidos}
          tramites={estado.cola}
        />
      )}

      {/* El nombre de la región va con su encabezado: sin él, `aria-labelledby`
          apuntaría a un identificador que no existe y la sección se quedaría
          sin nombre en vez de sin encabezado. */}
      <section aria-labelledby={hayTitulo ? TITULO : undefined} className="flex w-full flex-col gap-4">
        {hayTitulo && (
          <h2 className="text-2xl font-semibold" id={TITULO}>
            {tituloDe(loQueSeMira)}
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

          Lleva nombre porque desde los filtros de la lista hay una segunda
          región viva —el contador de lo que queda—, y dos regiones sin nombre
          son dos avisos que no se sabe de qué son.
        */}
        <p aria-label="Resumen de la búsqueda" className="text-lg" role="status">
          {dicho.resumen}
        </p>

        {/* Aparte del titular y con `alert`, que es lo que un lector de
            pantalla anuncia interrumpiendo: lo que no se ha podido preguntar
            no puede leerse como un resultado con cero huecos. */}
        {dicho.percance && (
          <p
            // Con nombre, por lo mismo que las dos regiones vivas: el aviso
            // pegado al campo también es un `alert`, y los dos salen a la vez
            // en cuanto alguien teclea un código postal malo con una búsqueda
            // fallida delante. Sin nombre no habría forma de pedir este.
            aria-label="Lo que ha impedido contestar"
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
            {loQueSeMira.localizacion?.precision === 'aproximada-provincial' && (
              <p className="text-base opacity-70">
                No hemos podido situar ese código postal con exactitud: las distancias están medidas desde el
                centro de {loQueSeMira.localizacion.provincia} y pueden fallar por decenas de kilómetros.
              </p>
            )}

            {/* El panel se pinta con **todas** las que hay y no con las que
                quedan: el contador cuenta sobre el total, y cuando los filtros
                dejan la lista a cero es justo cuando más falta hace que siga
                estando a la vista. */}
            {referencia !== null && (
              <FiltrosDeLaLista
                alCambiar={cambiarFiltros}
                cuantasSeVen={visibles.length}
                filtros={filtros}
                oficinas={oficinas}
                referencia={referencia}
              />
            )}

            {/* La lista y el mapa enseñan lo mismo: los dos son la misma
                respuesta mirada de dos maneras, y un mapa con puntos que la
                lista no tiene dejaría de serlo. Se quedan puestos aunque los
                filtros no dejen ninguna: un mapa que desaparece al mover un
                control se lleva la vista de donde se estaba mirando, y lo que
                pasa ya lo dice el panel. */}
            <Resultados
              busqueda={loQueSeMira.busqueda}
              localizacion={loQueSeMira.localizacion}
              oficinas={visibles}
            />
          </>
        )}
      </section>
    </>
  )
}
