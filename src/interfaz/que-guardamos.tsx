import { AnadirALaPantallaDeInicio } from './anadir-a-la-pantalla-de-inicio'

/**
 * Qué se guarda de quien pregunta, y qué no existe todavía.
 *
 * Las dos cosas van juntas porque son la misma promesa mirada por sus dos
 * caras. Que no se guarde nada es lo que hace que esto se pueda tener a mano
 * sin pensárselo; y que **los avisos no existan** es lo que hay que decir para
 * que nadie se vaya creyendo que ya no tiene que volver a mirar.
 *
 * Por eso aquí no hay ni un botón ni una casilla de avisos: quien la pulsara se
 * iría tranquilo, y esa es justo la persona que se queda sin cita. El texto se
 * cambia el día que existan, con su issue, y no antes.
 */
export function QueGuardamos() {
  return (
    <section className="seccion" id="guardamos">
      <div className="ancho partida">
        <div className="aparece">
          <p className="sobre">Tus datos</p>
          <h2>Nada, y por eso se puede tener a mano.</h2>

          {/*
            El párrafo entero y no una lista de puntos: es la promesa que sostiene
            todo lo demás, y se lee de una vez. En negrita lo que hay que poder
            leer de un vistazo, que es la respuesta.
          */}
          <p>
            <strong>Qué guardamos de ti: nada.</strong> No hay cuentas ni base de datos, y el código
            postal no viaja en ninguna dirección que quede registrada. El último que usas se queda en
            tu navegador, para proponértelo la próxima vez, y con él la última lista que consultaste,
            para poder enseñártela cuando te quedes sin cobertura. Las dos cosas están solo en tu
            móvil y se borran al borrar los datos del sitio.
          </p>

          <AnadirALaPantallaDeInicio />
        </div>

        <aside className="panel aparte aparece">
          <p className="sobre">Lo que todavía no hay</p>

          {/*
            Un solo párrafo y sin control ninguno: la única forma honrada de
            hablar de algo que no existe es contarlo, no enseñar su interruptor
            apagado.
          */}
          <p>
            Los avisos por notificación cuando aparezca un hueco{' '}
            <strong>todavía no existen</strong>: están en camino. De momento hay que volver a mirar,
            y por eso esto se añade a la pantalla de inicio y abre sin cobertura: para que mirar
            cueste un toque.
          </p>
        </aside>
      </div>
    </section>
  )
}
