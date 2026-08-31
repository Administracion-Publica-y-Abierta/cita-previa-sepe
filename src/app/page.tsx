import { ComoFunciona } from '@/interfaz/como-funciona'
import { CuandoMirar } from '@/interfaz/cuando-mirar'
import { ElPie } from '@/interfaz/el-pie'
import { LaBarra } from '@/interfaz/la-barra'
import { LaPantalla } from '@/interfaz/la-pantalla'
import { LoQueAparece } from '@/interfaz/lo-que-aparece'
import { Preguntas } from '@/interfaz/preguntas'
import { QueGuardamos } from '@/interfaz/que-guardamos'

/**
 * La primera pantalla.
 *
 * Es una portada de arriba abajo porque quien llega **no sabe qué es esto**:
 * llega de una búsqueda o de un enlace que le ha pasado alguien, y antes de
 * teclear necesita entender en cinco segundos que esto no es el SEPE, que aquí
 * no se reserva y qué le va a salir. El hero manda, y debajo está todo lo que
 * responde a «¿y esto de quién es?».
 *
 * El orden no es decorativo. Primero el campo; después las oficinas, con la
 * vista bajando sola hasta ellas al pulsar; y **justo debajo, cuándo mirar**,
 * porque quien más lo necesita es quien acaba de mirar y no ha encontrado nada.
 * Lo que se lee con calma —cómo funciona, qué se guarda, las preguntas— va
 * después, y lo legal en el pie.
 *
 * Lo único que necesita navegador es `LaPantalla`. Todo lo demás es texto que
 * se manda pintado, que es lo que hace que esta página se pueda leer entera
 * antes de que llegue una sola línea de JavaScript.
 */
export default function Portada() {
  return (
    <>
      <LaBarra />

      <main id="arriba">
        <LaPantalla />
        <CuandoMirar />
        <ComoFunciona />
        <QueGuardamos />
        <Preguntas />
      </main>

      <ElPie />
      <LoQueAparece />
    </>
  )
}
