/**
 * Cuándo salen los huecos.
 *
 * Va justo debajo de la lista y no al final de la página porque quien más lo
 * necesita es quien acaba de mirar y no ha encontrado nada: es lo único que se
 * le puede ofrecer hoy, mientras los avisos no existan.
 *
 * Lo que dice **no lo publica el SEPE en ninguna parte**: sale de mirarlo, y
 * por eso se presenta como una pista y no como un horario. Prometer una hora a
 * la que hay citas sería la misma clase de mentira que contar un SEPE caído
 * como «no hay huecos».
 */

const CUANDOS = [
  {
    k: 'Entre semana',
    cuando: 'De 7:00 a 8:00',
    texto:
      'Es la franja en la que más veces aparecen huecos nuevos. Si solo puedes mirar a una hora fija, que sea esta.',
  },
  {
    k: 'Fin de semana',
    cuando: 'Los domingos',
    texto:
      'El fin de semana también salen, y sobre todo el domingo. Mirar un sábado por la tarde suele dar menos.',
  },
  {
    k: 'El resto del día',
    cuando: 'A cualquier hora',
    texto:
      'Cuando alguien anula su cita, su hueco vuelve a estar libre en ese momento. Por eso puede aparecer uno a media tarde de un martes sin ninguna razón.',
  },
]

export function CuandoMirar() {
  return (
    <section className="seccion" id="cuando">
      <div className="ancho">
        <div className="cabecera aparece">
          <p className="sobre">Cuándo mirar</p>
          <h2>Las horas no salen a cualquier hora.</h2>
          <p>
            Esto no lo dice el SEPE en ninguna parte: es lo que se ve mirando. Tómatelo como una
            pista de por dónde empezar, no como un horario.
          </p>
        </div>

        <div className="rejilla-tres">
          {CUANDOS.map(({ k, cuando, texto }) => (
            <article className="ficha-seccion aparece" key={k}>
              <p className="sobre ficha-seccion__k">{k}</p>
              <p className="ficha-seccion__cuando">{cuando}</p>
              <p>{texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
