import { CODIGO } from './enlaces'

/**
 * El pie: lo legal, y de dónde salen los datos.
 *
 * Está abajo porque se lee después, no porque sea letra pequeña. Lo que no
 * puede esperar al pie —que esto no es el SEPE y que aquí no se reserva— está
 * arriba del todo, encima del campo.
 */
export function ElPie() {
  return (
    <footer className="ancho pie">
      <p>
        Los horarios y los huecos vienen de la sede pública del SEPE en el momento de la consulta y{' '}
        <strong>pueden cambiar en cualquier momento</strong>: que aquí aparezca un hueco no lo
        reserva ni lo aparta.
      </p>

      <p>
        Proyecto independiente, sin relación con el Servicio Público de Empleo Estatal.{' '}
        <a href={CODIGO} rel="noreferrer noopener" target="_blank">
          Código fuente
        </a>
        .
      </p>
    </footer>
  )
}
