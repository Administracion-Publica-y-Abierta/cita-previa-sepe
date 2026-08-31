/**
 * Lo que hay que saber antes de fiarse.
 *
 * Son `details` de verdad y no un acordeón nuestro: el navegador ya sabe
 * abrirlos con el teclado y anunciarlos, y la primera va abierta para que se
 * entienda de qué va esto sin pulsar nada.
 *
 * La que más importa es la primera y por eso está la primera: quien llega de
 * una búsqueda cree a menudo que esto **es** el SEPE, y esa confusión le puede
 * costar la cita.
 */

const PREGUNTAS = [
  {
    pregunta: '¿Esto es el SEPE?',
    respuesta:
      'No. Es un proyecto independiente que lee la sede pública del SEPE y te enseña lo que dice, ordenado por cercanía. No tiene ninguna relación con el Servicio Público de Empleo Estatal.',
  },
  {
    pregunta: '¿Puedo reservar la cita aquí?',
    respuesta:
      'Todavía no. Aquí ves dónde hay hueco y a qué hora; la cita se pide en la sede del SEPE, con el enlace que hay arriba. Que aquí aparezca un hueco no lo reserva ni lo aparta para ti.',
  },
  {
    pregunta: '¿Tengo que saber cómo se llama mi trámite?',
    respuesta:
      'No. Sin marcar nada se enseñan todas las oficinas de tu zona, que es como abre la pantalla. Marcar sirve para estrechar la lista cuando ya la tienes delante, y puedes marcar varios a la vez: los nombres son los del SEPE, los mismos que te va a pedir su sede.',
  },
  {
    pregunta: '¿Por qué tarda casi un minuto?',
    respuesta:
      'Porque cada trámite es una consulta a la sede del SEPE y se hacen despacio a propósito, con una pausa entre una y otra. Ir más rápido sería cargarle el servicio a un sitio público que usa mucha más gente. Mientras tanto, lo que ya ha llegado se puede mirar.',
  },
  {
    pregunta: '¿Las horas que salen son todas las que tiene la oficina?',
    respuesta:
      'No: de cada oficina se enseña su primer hueco, el más temprano. El desglose de días y horas del SEPE exige el DNI y aquí no se pide, así que el filtro de franja horaria mira ese primer hueco y no la agenda entera.',
  },
  {
    pregunta: '¿Por qué a veces no me sale ni una oficina?',
    respuesta:
      'Hay dos motivos y no son el mismo, así que se dicen distinto: o el SEPE ha contestado y no hay huecos —entonces toca mirar otra zona—, o el SEPE no ha contestado, y entonces toca volver en un rato. La pantalla siempre dice cuál de los dos ha pasado.',
  },
  {
    pregunta: '¿Me vais a avisar cuando aparezca un hueco?',
    respuesta:
      'Todavía no se puede, y hasta que se pueda no vas a ver aquí ningún botón que lo prometa. Mientras tanto, añade esto a la pantalla de inicio: abre aunque te quedes sin cobertura y te enseña lo último que consultaste, con el día y la hora en que se consultó.',
  },
]

export function Preguntas() {
  return (
    <section className="seccion seccion--otra" id="preguntas">
      <div className="ancho">
        <div className="cabecera aparece">
          <p className="sobre">Preguntas</p>
          <h2>Lo que hay que saber antes de fiarse.</h2>
        </div>

        <div className="preguntas aparece">
          {PREGUNTAS.map(({ pregunta, respuesta }, cual) => (
            <details key={pregunta} open={cual === 0}>
              <summary>{pregunta}</summary>
              <p>{respuesta}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
