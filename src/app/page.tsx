/**
 * Portada provisional. El hero de verdad —campo de código postal, botón
 * «Comprobar horas», mapa y filtros— llega con la Fase 1; esto solo sirve para
 * que `npm run dev` enseñe algo coherente mientras tanto.
 */
export default function Portada() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Cita previa SEPE</h1>

      <p className="text-lg">
        Una forma decente de enterarse de que hay cita en el SEPE. Se escribe un código postal y se ve qué
        oficinas tienen hueco, sin dar el DNI y sin crear ninguna cuenta.
      </p>

      <p className="text-base">
        En construcción: todavía no se puede consultar nada desde aquí. La cita se sigue pidiendo en la{' '}
        <a
          className="underline"
          href="https://sede.sepe.gob.es/citaprevia"
          rel="noreferrer noopener"
          target="_blank"
        >
          sede electrónica del SEPE
        </a>
        .
      </p>

      <p className="text-sm">
        Proyecto independiente, sin relación con el Servicio Público de Empleo Estatal. Los datos que se
        muestren vendrán de su sede pública y pueden cambiar en cualquier momento.
      </p>
    </main>
  )
}
