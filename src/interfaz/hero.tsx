'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import type { BusquedaDelPrimerTramite } from '@/sepe/primer-tramite'
import { avisoDe, soloDigitos } from './codigo-postal'
import { ListaDeOficinas } from './lista-de-oficinas'
import {
  codigoPostalDeLaDireccion,
  ponerEnLaDireccion,
  recordarCodigoPostal,
  ultimoCodigoPostal,
} from './lo-que-recuerda-el-navegador'

/**
 * Un campo y un botón.
 *
 * Es la decisión de diseño de esta pantalla y conviene que esté escrita: quien
 * llega no debería tener que decidir nada antes de empezar. No se elige
 * trámite —el filtro llega en el issue #10, cuando ya hay una lista delante
 * que filtrar—, no se crea cuenta, y **no se pide el DNI**: nadie entrega un
 * dato antes de saber si le merece la pena.
 */

const RUTA = '/api/oficinas'

/** Los identificadores de los textos atados al campo. Fijos, para poder citarlos. */
const AVISO = 'aviso-del-codigo-postal'
const AYUDA = 'ayuda-del-codigo-postal'

/**
 * Lo que se enseña cuando el servidor rechaza el código postal.
 *
 * Va pegado al campo y no en los resultados: ahí es donde está el arreglo. Es
 * un texto nuestro y no el del servidor porque el mensaje que se enseña es
 * cosa de la pantalla, y porque así no se enseña nunca algo que haya venido
 * por la red.
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

type Estado =
  | { fase: 'inicial' }
  | { fase: 'buscando' }
  | { fase: 'hecho'; busqueda: BusquedaDelPrimerTramite }
  /** El servidor dice que ese código postal no vale. */
  | { fase: 'rechazado' }
  /** Ni siquiera se ha llegado a nuestro servidor: no hay red, o está caído. */
  | { fase: 'sin-conexion' }

/**
 * La consulta, y nada más: no toca estado, devuelve en qué ha quedado.
 *
 * Está fuera del componente a propósito. Así el efecto que la lanza no cambia
 * estado por su cuenta —solo lo hace la respuesta, cuando llega— y esto se
 * puede leer sin saber nada de React.
 */
async function pedirOficinas(codigoPostal: string): Promise<Estado> {
  try {
    const respuesta = await fetch(RUTA, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // El código postal va en el cuerpo y no en la URL: el alojamiento
      // registra la URL entera de cada petición solo por existir.
      body: JSON.stringify({ cp: codigoPostal }),
    })

    if (!respuesta.ok) return { fase: 'rechazado' }
    return { fase: 'hecho', busqueda: (await respuesta.json()) as BusquedaDelPrimerTramite }
  } catch {
    return { fase: 'sin-conexion' }
  }
}

export function Hero() {
  // La búsqueda que trae el enlace, y el último código postal usado. Se leen
  // en el primer pintado del navegador y no en un efecto: el campo tiene que
  // salir ya relleno, sin parpadear vacío primero.
  const compartido = useSyncExternalStore(SIN_CAMBIOS, codigoPostalDeLaDireccion, EN_EL_SERVIDOR)
  const propuesto = useSyncExternalStore(SIN_CAMBIOS, ultimoCodigoPostal, EN_EL_SERVIDOR)

  /** Lo tecleado, o `null` mientras no se haya tecleado nada. */
  const [escrito, setEscrito] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  /** En qué ha quedado la última consulta, o `null` si no ha terminado ninguna. */
  const [resultado, setResultado] = useState<Estado | null>(null)

  // El `??` de fuera y no `||`: borrar el campo del todo es teclear, y
  // entonces tiene que quedarse vacío en vez de volver a proponer lo de antes.
  // Dentro sí es `||`, porque los dos son cadenas y se busca la primera con
  // algo dentro.
  const codigoPostal = escrito ?? (compartido || propuesto)

  // Si el enlace traía búsqueda y todavía no hay respuesta, es que se está
  // buscando: la consulta sale en el mismo pintado, desde el efecto de abajo.
  const estado: Estado = resultado ?? (compartido ? { fase: 'buscando' } : { fase: 'inicial' })

  const aplicar = useCallback((siguiente: Estado) => {
    setResultado(siguiente)
    if (siguiente.fase === 'rechazado') setAviso(LO_RECHAZA_EL_SERVIDOR)
  }, [])

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
    if (compartido) void pedirOficinas(compartido).then(aplicar)
  }, [compartido, aplicar])

  function alEscribir(tecleado: string): void {
    const limpio = soloDigitos(tecleado)
    setEscrito(limpio)
    // El aviso se quita en cuanto deja de ser cierto, pero no aparece mientras
    // se teclea: avisar de que «faltan dígitos» a quien va por el segundo es
    // regañar a alguien que lo está haciendo bien.
    if (aviso && avisoDe(limpio) === null) setAviso(null)
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
    setResultado({ fase: 'buscando' })
    void pedirOficinas(codigoPostal).then(aplicar)
  }

  const busqueda = estado.fase === 'hecho' ? estado.busqueda : null

  return (
    <>
      {/* `noValidate` para que el aviso sea el nuestro y no el globo del
          navegador, que ni se puede redactar ni lo lee un lector de pantalla
          con la misma fiabilidad. */}
      <form className="flex flex-col gap-3" noValidate onSubmit={alEnviar}>
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

      <section aria-labelledby="titulo-de-los-resultados" className="flex flex-col gap-4">
        {/* Hasta que no se ha buscado no hay resultados de los que hablar, y un
            «Resultados» con nada debajo es ruido justo en la pantalla que tiene
            que entenderse en cinco segundos. La región viva de abajo sí se queda
            desde el principio. */}
        {estado.fase !== 'inicial' && (
          <h2 className="text-2xl font-semibold" id="titulo-de-los-resultados">
            {tituloDe(busqueda)}
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
          {resumenDe(estado)}
        </p>

        {busqueda?.estado === 'ok' && busqueda.oficinas.length > 0 && (
          <>
            {busqueda.localizacion?.precision === 'aproximada-provincial' && (
              <p className="text-base opacity-70">
                No hemos podido situar ese código postal con exactitud: las distancias están medidas desde el
                centro de {busqueda.localizacion.provincia} y pueden fallar por decenas de kilómetros.
              </p>
            )}
            <ListaDeOficinas oficinas={busqueda.oficinas} />
          </>
        )}
      </section>
    </>
  )
}

function tituloDe(busqueda: BusquedaDelPrimerTramite | null): string {
  // El trámite en el título y no en letra pequeña: la lista son las oficinas
  // *de algo*, y quien pregunta no ha elegido ese algo.
  return busqueda?.tramite ? `Resultados para «${busqueda.tramite.nombre}»` : 'Resultados'
}

function resumenDe(estado: Estado): string {
  switch (estado.fase) {
    case 'inicial':
      return ''
    case 'buscando':
      return 'Buscando oficinas. Puede tardar un minuto: al SEPE se le pregunta despacio a propósito.'
    case 'sin-conexion':
      return 'No se ha podido conectar. Comprueba la conexión y vuelve a probar.'
    // El aviso de un código postal rechazado va pegado al campo, que es donde
    // está el arreglo; aquí no se dice nada.
    case 'rechazado':
      return ''
    default:
      return resumenDeLaBusqueda(estado.busqueda)
  }
}

function resumenDeLaBusqueda(busqueda: BusquedaDelPrimerTramite): string {
  switch (busqueda.estado) {
    // Los tres que siguen no son «no hay citas», y decirlo importa: quien lea
    // «no hay citas» deja de mirar, y lo que pasa es que no se ha podido
    // preguntar.
    case 'sepe-no-responde':
      return 'El SEPE no responde ahora mismo. No es que no haya citas: es que no se le ha podido preguntar. Vuelve a probar en un rato.'
    case 'sin-agenda':
      return 'El SEPE ha contestado sin agenda. Le pasa a ratos y no significa que no haya citas. Vuelve a probar en un rato.'
    case 'sin-tramites':
      return 'El SEPE no ofrece ningún trámite con cita previa en esta zona.'
    default:
      return resumenDeLasOficinas(busqueda)
  }
}

function resumenDeLasOficinas(busqueda: BusquedaDelPrimerTramite): string {
  const cuantas = busqueda.oficinas.length
  if (cuantas === 0) return 'El SEPE no atiende este trámite en ninguna oficina de la zona.'

  const conHueco = busqueda.oficinas.filter((oficina) => oficina.primerHueco !== null).length
  const donde = busqueda.localizacion?.municipio ?? busqueda.localizacion?.provincia ?? 'tu zona'
  const cabecera = cuantas === 1 ? `1 oficina cerca de ${donde}` : `${cuantas} oficinas cerca de ${donde}`

  if (conHueco === 0) return `${cabecera}, ninguna con hueco ahora mismo.`
  if (conHueco === 1) return `${cabecera}, 1 con hueco.`
  return `${cabecera}, ${conHueco} con hueco.`
}
