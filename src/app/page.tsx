import { Hero } from '@/interfaz/hero'

/**
 * La primera pantalla.
 *
 * Lo que rodea al formulario no es relleno legal: es lo que hace que la web
 * sea honesta. Quien llega buscando cita del SEPE tiene que entender en cinco
 * segundos que **esto no es el SEPE**, que aquí **todavía no se reserva** y
 * dónde se reserva de verdad. Confundirse en eso le cuesta a alguien la cita.
 *
 * Está arriba y no en el pie por lo mismo: un aviso que hay que buscar no
 * avisa. Lo que se puede leer después —el código fuente, qué se guarda, de
 * dónde salen los datos— sí baja al pie.
 */

const SEDE = 'https://sede.sepe.gob.es/citaprevia'
const CODIGO = 'https://github.com/Administracion-Publica-y-Abierta/cita-previa-sepe'

export default function Portada() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12 sm:py-20">
      <header className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <p className="text-base font-medium uppercase tracking-wide opacity-70">
          Esto no es el SEPE. Proyecto independiente.
        </p>

        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Mira si hay cita del SEPE cerca de ti
        </h1>

        <p className="text-xl">
          Escribe tu código postal y verás qué oficinas tienen hueco, a qué distancia están y a qué hora
          atienden. Sin cuenta, sin elegir trámite y sin dar el DNI.
        </p>

        <p className="text-lg">
          Aquí todavía no se reserva la cita: cuando encuentres tu hueco, la cita se pide en la{' '}
          <a className="underline" href={SEDE} rel="noreferrer noopener" target="_blank">
            sede electrónica del SEPE
          </a>
          .
        </p>
      </header>

      <Hero />

      <footer className="mx-auto flex w-full max-w-3xl flex-col gap-2 border-t border-black/10 pt-6 text-base opacity-80 dark:border-white/15">
        <p>
          <strong>Qué guardamos de ti: nada.</strong> No hay cuentas ni base de datos, y el código postal no
          viaja en ninguna dirección que quede registrada. El último que usas se queda en tu navegador, para
          proponértelo la próxima vez, y se borra al borrar los datos del sitio.
        </p>
        <p>
          Los horarios y los huecos vienen de la sede pública del SEPE en el momento de la consulta y{' '}
          <strong>pueden cambiar en cualquier momento</strong>: que aquí aparezca un hueco no lo reserva ni lo
          aparta.
        </p>
        <p>
          Proyecto independiente, sin relación con el Servicio Público de Empleo Estatal.{' '}
          <a className="underline" href={CODIGO} rel="noreferrer noopener" target="_blank">
            Código fuente
          </a>
          .
        </p>
      </footer>
    </main>
  )
}
