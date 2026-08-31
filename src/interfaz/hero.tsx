import type { FormEvent } from 'react'
import { SEDE } from './enlaces'

/**
 * Un campo y un botón.
 *
 * Es la decisión de diseño de esta pantalla y conviene que siga escrita: quien
 * llega no tiene que decidir nada antes de empezar. No se elige trámite —el
 * selector sale **después**, cuando el SEPE ya ha dicho qué hay en la zona—, no
 * se crea cuenta y **no se pide el DNI**: nadie entrega un dato antes de saber
 * si le merece la pena.
 *
 * Lo que rodea al campo no es relleno legal: es lo que hace que la web sea
 * honesta. Quien llega buscando cita tiene que entender en cinco segundos que
 * **esto no es el SEPE**, que aquí **todavía no se reserva** y dónde se reserva
 * de verdad. Está encima del campo y no en el pie por lo mismo: un aviso que
 * hay que buscar no avisa.
 *
 * El código postal es **un solo campo** y no cinco celdas, aunque la ronda de
 * diseño las probara: el navegador autorrellena un campo de una vez, un lector
 * de pantalla lo lee una vez y no cinco, y quien pega los cinco dígitos no
 * tiene que ver cómo se reparten. Lo que sí se asciende de aquella idea es el
 * aspecto —grande, en cifras monoespaciadas y con aire entre los dígitos—.
 */

/** Los identificadores de los textos atados al campo. Fijos, para poder citarlos. */
const AVISO = 'aviso-del-codigo-postal'
const AYUDA = 'ayuda-del-codigo-postal'

export function Hero({
  codigoPostal,
  aviso,
  buscando,
  alEscribir,
  alEnviar,
}: {
  codigoPostal: string
  /** Lo que impide buscar, pegado al campo. `null` cuando no hay nada que decir. */
  aviso: string | null
  buscando: boolean
  alEscribir: (tecleado: string) => void
  alEnviar: (evento: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="hero">
      <div className="ancho hero__texto aparece">
        <p className="sobre">Esto no es el SEPE. Proyecto independiente.</p>

        <h1 className="titular">
          Cinco dígitos y sabes <em>dónde hay cita</em>.
        </h1>

        <p className="entradilla">
          Escribe tu código postal y verás qué oficinas del SEPE tienen hueco, a qué distancia están
          y a qué hora atienden. Sin cuenta, sin elegir trámite y sin dar el DNI.
        </p>

        <p className="hero__aqui-no">
          Aquí todavía no se reserva la cita: cuando encuentres tu hueco, la cita se pide en la{' '}
          <a href={SEDE} rel="noreferrer noopener" target="_blank">
            sede electrónica del SEPE
          </a>
          .
        </p>

        {/* `noValidate` para que el aviso sea el nuestro y no el globo del
            navegador, que ni se puede redactar ni lo lee un lector de pantalla
            con la misma fiabilidad. */}
        <form className="campo" noValidate onSubmit={alEnviar}>
          <label className="sobre" htmlFor="codigo-postal">
            Código postal
          </label>

          <div className="campo__fila">
            <input
              aria-describedby={`${AYUDA} ${AVISO}`}
              aria-invalid={aviso !== null}
              autoComplete="postal-code"
              className="campo__dato"
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

            {/* El texto del botón no cambia mientras se busca, aunque se
                apague: es el nombre por el que se le llama —«el botón de
                comprobar horas»— y renombrarlo a media espera se lo cambia de
                debajo del dedo a quien lo está buscando con un lector de
                pantalla. Que se está buscando lo dicen el botón apagado y el
                punto que late al lado del titular. */}
            <button className="boton campo__boton" disabled={buscando} type="submit">
              Comprobar horas
            </button>
          </div>

          <p className="campo__letra" id={AYUDA}>
            Cinco dígitos. No hace falta nada más: ni DNI, ni cuenta, ni correo.
          </p>

          {/* Aparece solo cuando hay algo que decir: un `alert` que nace con el
              aviso dentro es el que los lectores de pantalla anuncian. */}
          {aviso !== null && (
            <p aria-label="Aviso del código postal" className="campo__error" id={AVISO} role="alert">
              {aviso}
            </p>
          )}
        </form>
      </div>
    </section>
  )
}
