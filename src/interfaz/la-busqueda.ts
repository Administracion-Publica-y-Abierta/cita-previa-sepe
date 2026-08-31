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
import { aplicando, SIN_FILTROS, type Filtros } from './filtros'
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
  type OficinaConSuTramite,
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
import { loQueSeDice, seCuentaAlgo, tituloDe, type LoQueSeDice } from './resumen'
import { loQueHayQuePedir, soloLoElegido, type PorQueSePregunta } from './tramites-elegidos'

/**
 * Todo lo que la pantalla sabe: la búsqueda, lo que va llegando, lo marcado y
 * lo filtrado.
 *
 * Vive fuera del componente porque **no es maquetación**: es el bucle que sale
 * al SEPE, la cola de lo marcado y las funciones puras que filtran lo que ya
 * está aquí. Sacarlo aparte es lo que permite pintar esta misma búsqueda de
 * varias maneras sin duplicar ni una de sus reglas —y las reglas son la parte
 * que no se puede equivocar—.
 *
 * Lo que hay que seguir sabiendo antes de tocarlo, y está escrito donde pasa:
 * la búsqueda es un **bucle** y no una llamada, marcar un trámite **no relanza
 * nada**, y los filtros de la lista **no cuestan ni una petición**.
 */

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

export interface LaBusqueda {
  /** Lo que hay en el campo: lo tecleado, lo del enlace o lo último usado. */
  codigoPostal: string
  /** Lo que impide buscar, pegado al campo. `null` cuando no hay nada que decir. */
  aviso: string | null
  alEscribir: (tecleado: string) => void
  alEnviar: (evento: FormEvent<HTMLFormElement>) => void
  /**
   * Lo mismo que `alEnviar` pero diciendo por qué trámites se pregunta. Es lo
   * que necesita una pantalla que deja elegirlos **antes** de buscar: sin esto,
   * elegir tres de veintitrés seguiría costando la pasada de los veintitrés.
   */
  buscarLaZona: (tramites: number[]) => void
  /** Hay una pasada abierta: el botón se deshabilita y la pantalla lo cuenta. */
  buscando: boolean
  /** Todo lo llegado, incluido lo que ahora mismo no se mira. De aquí sale la cola. */
  estado: LoQueVaLlegando
  /** Lo mismo, visto solo por lo marcado. Es lo que se enseña. */
  loQueSeMira: LoQueVaLlegando
  elegidos: number[]
  cambiarLoMarcado: (nuevos: number[]) => void
  /**
   * Lo mismo, pero **sin salir al SEPE**: cambia lo que se mira y nada más.
   *
   * Existe para las pantallas donde elegir trámite y comprobar son dos gestos
   * distintos. Ahí, marcar uno que no se ha consultado no puede lanzar una
   * consulta sola: quien está eligiendo todavía está eligiendo, y cada trámite
   * son 2,5 segundos de freno que nadie ha pedido gastar.
   */
  soloMirar: (nuevos: number[]) => void
  filtros: Filtros
  cambiarFiltros: (nuevos: Filtros) => void
  /** Todas las que han llegado de lo marcado, **sin filtrar**. */
  oficinas: OficinaConSuTramite[]
  /** Las que dejan los filtros de la lista, ya ordenadas. */
  visibles: OficinaConSuTramite[]
  /** Desde cuándo cuentan «hoy», «esta semana» y «este mes». `null` hasta el primer trámite. */
  referencia: number | null
  dicho: LoQueSeDice
  /** Si hay algo que titular, o la pantalla se queda como estaba. */
  hayTitulo: boolean
  titulo: string
  volverAComprobar: () => void
}

export function useLaBusqueda(): LaBusqueda {
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
  const seguir = useCallback(
    async (codigoPostal: string, primeros: PorQueSePregunta, numero: number) => {
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
    },
    [],
  )

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

  /**
   * Buscar la zona del campo, con los trámites que se digan.
   *
   * Los trámites se pasan y no se heredan: los de la zona anterior no son
   * estos, y arrastrar sus identificadores dejaría una búsqueda nueva filtrada
   * por algo que no existe aquí. Quien tenga unos válidos —porque acaba de
   * pedir el árbol de **esta** zona— los pone; quien no, manda `NINGUNO` y se
   * miran todos.
   *
   * Los filtros de la lista sí se conservan: no son de esta zona ni de estos
   * trámites —«a menos de cinco kilómetros» quiere decir lo mismo en cualquier
   * código postal—, así que tirarlos sería deshacer algo que nadie ha pedido
   * deshacer.
   */
  function buscarLaZona(tramites: number[]): void {
    const problema = avisoDe(codigoPostal)
    if (problema) {
      setAviso(problema)
      return
    }

    recordarCodigoPostal(codigoPostal)
    setMarcado(tramites)
    ponerEnLaDireccion(codigoPostal, tramites, filtros)

    setAviso(null)
    buscarOficinas(codigoPostal, tramites)
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    buscarLaZona(NINGUNO)
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
   * Cambiar lo marcado sin preguntarle nada al SEPE.
   *
   * Es el filtro y solo el filtro: `soloLoElegido` estrecha la vista y lo
   * desmarcado sigue entero en `estado`, así que volver a marcarlo no cuesta
   * nada. Lo que se marque y no se haya consultado no aparece hasta que alguien
   * pulse el botón, que es exactamente lo que se quiere: la consulta la pide
   * una persona, no una casilla.
   */
  function soloMirar(nuevos: number[]): void {
    setMarcado(nuevos)
    if (zona.current) ponerEnLaDireccion(zona.current, nuevos, filtros)
  }

  /**
   * Lo mismo, visto solo por lo marcado. Es lo que se enseña: el filtro mira y
   * no tira, así que `estado` sigue teniendo lo desmarcado entero por si vuelve
   * a marcarse.
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

  return {
    codigoPostal,
    aviso,
    alEscribir,
    alEnviar,
    buscarLaZona,
    buscando: estado.fase === 'buscando',
    estado,
    loQueSeMira,
    elegidos,
    cambiarLoMarcado,
    soloMirar,
    filtros,
    cambiarFiltros,
    oficinas,
    visibles,
    referencia,
    dicho,
    hayTitulo,
    titulo: tituloDe(loQueSeMira),
    volverAComprobar,
  }
}
