import { SEDE } from './enlaces'

/**
 * La barra de arriba: quién es esto y dónde se reserva de verdad.
 *
 * Se queda pegada al hacer scroll y lleva **un solo enlace destacado**, el de
 * la sede del SEPE. No es adorno de navegación: quien baja hasta las oficinas y
 * encuentra su hueco tiene ahí mismo a dónde ir, sin volver a subir a buscarlo.
 *
 * Y no lleva ni un botón, a propósito: lo único que se pulsa en esta pantalla
 * antes de buscar es «Comprobar horas». Un botón más arriba es una decisión más
 * que tomar antes de escribir cinco dígitos.
 */
export function LaBarra() {
  return (
    <header className="barra">
      <div className="ancho barra__dentro">
        <a className="marca" href="#arriba">
          <span aria-hidden className="marca__punto" />
          Cita SEPE
        </a>

        <nav aria-label="Secciones de esta página" className="enlaces">
          <a href="#cuando">Cuándo mirar</a>
          <a href="#como">Cómo funciona</a>
          <a href="#guardamos">Qué guardamos</a>
          <a href="#preguntas">Preguntas</a>
        </nav>

        <div className="barra__derecha">
          <a
            className="boton boton--liso boton--pequeno"
            href={SEDE}
            rel="noreferrer noopener"
            target="_blank"
          >
            Reservar en el SEPE
          </a>
        </div>
      </div>
    </header>
  )
}
