/**
 * De la pantalla a la oficina, en tres pasos.
 *
 * El tercero **no es aquí**, y esa es la razón de que esta sección exista: esto
 * lee la sede pública del SEPE y enseña lo que dice, y reservar sigue siendo
 * cosa suya. Decirlo tres veces —en el hero, aquí y en las preguntas— no es
 * repetirse: confundirse en eso le cuesta a alguien la cita.
 */

const PASOS = [
  {
    k: 'Paso 01',
    titulo: 'Tu código postal',
    texto:
      'Cinco dígitos y nada más: ni cuenta, ni correo, ni DNI. Con eso ya se puede salir a mirar qué oficinas del SEPE tienes cerca y cuáles tienen hueco.',
  },
  {
    k: 'Paso 02 · 2,5 s por trámite',
    titulo: 'Se van llenando las oficinas',
    texto:
      'Cada trámite de tu zona es una consulta a la sede, y van llegando de una en una. No hace falta esperar al final: lo que ya está se puede filtrar y ordenar mientras llega el resto. Si sabes a qué vas, marca tu trámite y la lista se estrecha sin volver a preguntar nada.',
  },
  {
    k: 'Paso 03 · en la sede',
    titulo: 'Reservas en el SEPE',
    texto:
      'Ya sabes a qué oficina y a qué hora. Que aquí aparezca un hueco no lo reserva ni lo aparta: quien lo da es la sede, con el enlace que hay arriba.',
  },
]

export function ComoFunciona() {
  return (
    <section className="seccion seccion--otra" id="como">
      <div className="ancho">
        <div className="cabecera aparece">
          <p className="sobre">De la pantalla a la oficina</p>
          <h2>Tres pasos, y el último no es aquí.</h2>
          <p>
            Esto lee la sede pública del SEPE y te enseña lo que dice, ordenado por cercanía.
            Reservar sigue siendo cosa suya, y decirlo claro es la mitad del trabajo.
          </p>
        </div>

        <div className="rejilla-tres">
          {PASOS.map(({ k, titulo, texto }) => (
            <article className="ficha-seccion aparece" key={k}>
              <p className="sobre ficha-seccion__k">{k}</p>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
