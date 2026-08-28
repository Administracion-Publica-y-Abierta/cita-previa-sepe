'use client'

import { useId } from 'react'
import {
  CUANDOS,
  FRANJAS,
  hayFiltros,
  KM_MAXIMO,
  KM_MINIMO,
  nombreDelFiltro,
  ORDENES,
  porQueNoQuedaNinguna,
  quienLasTapa,
  quitando,
  quitandoTodos,
  type Filtros,
  type Opcion,
  type Orden,
} from './filtros'
import { enKilometros } from './formato'
import type { OficinaConSuTramite } from './lo-que-va-llegando'

/**
 * Los controles con los que se estrecha la lista que ya ha llegado.
 *
 * Aquí no hay ni una decisión: quién queda dentro, quién ordena antes, qué
 * filtro está tapando la lista y cómo se dice todo eso lo decide `filtros.ts`,
 * que son funciones puras y se prueban sin montar pantalla. Esto es la parte
 * que hay que ver y tocar.
 *
 * Las dos cosas que este panel tiene que hacer bien, y que son las que sacan a
 * alguien de un callejón sin salida: **el contador siempre a la vista**, para
 * saber si uno se ha pasado de restrictivo antes de concluir que no hay citas;
 * y cuando no queda nada, **decir qué filtro las tapa** y poder quitarlo de un
 * clic, en vez de tener que empezar de cero.
 */
export function FiltrosDeLaLista({
  filtros,
  alCambiar,
  oficinas,
  cuantasSeVen,
  referencia,
}: {
  filtros: Filtros
  alCambiar: (filtros: Filtros) => void
  /** Todas las que han llegado, **sin filtrar**: el contador cuenta sobre esto. */
  oficinas: OficinaConSuTramite[]
  /** Cuántas quedan puestos los filtros. La lista ya filtrada la pinta quien llama. */
  cuantasSeVen: number
  /** Desde cuándo se cuentan «hoy», «esta semana» y «este mes». */
  referencia: number
}) {
  const distancia = useId()
  const orden = useId()
  const tapando = quienLasTapa(oficinas, filtros, referencia)

  return (
    <section
      aria-label="Filtros de la lista"
      className="flex flex-col gap-5 rounded-lg border border-black/10 p-5 dark:border-white/15"
    >
      <div className="flex flex-col gap-2">
        <label className="text-base font-medium" htmlFor={distancia}>
          Distancia máxima: {aQueDistancia(filtros.km)}
        </label>

        <input
          // El valor que se anuncia es el que se lee, no el número del control:
          // un lector que diga «cien» donde la pantalla pone «sin límite» está
          // contando otra cosa.
          aria-valuetext={aQueDistancia(filtros.km)}
          className="w-full"
          id={distancia}
          max={KM_MAXIMO}
          min={KM_MINIMO}
          onChange={(evento) => alCambiar({ ...filtros, km: Number(evento.target.value) })}
          step={1}
          type="range"
          value={filtros.km}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base font-medium">Primer hueco de la oficina</legend>

        {/* Va antes de los controles y no en letra pequeña debajo: es lo que
            evita entender que aquí se filtra la agenda de la oficina. El
            desglose por horas del SEPE exige el DNI, y esta fase no lo pide. */}
        <p className="text-sm opacity-70">
          Se filtra por la hora del primer hueco de cada oficina. No es su agenda: aquí no se ven todos
          los huecos de una oficina, solo el más temprano.
        </p>

        <Opciones
          alElegir={(franja) => alCambiar({ ...filtros, franja })}
          elegida={filtros.franja}
          grupo={`${distancia}-franja`}
          opciones={FRANJAS}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        {/* «Cuándo es el primer hueco» y no «cuándo hay hueco»: lo segundo se
            lee como la disponibilidad de la oficina, que es justo lo que esta
            pantalla no sabe y no puede dar a entender que sabe. */}
        <legend className="text-base font-medium">Cuándo es el primer hueco</legend>

        <Opciones
          alElegir={(cuando) => alCambiar({ ...filtros, cuando })}
          elegida={filtros.cuando}
          grupo={`${distancia}-cuando`}
          opciones={CUANDOS}
        />
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-base font-medium" htmlFor={orden}>
          Ordenar por
        </label>

        <select
          className="rounded-lg border-2 border-black/30 px-3 py-2 text-base dark:border-white/30"
          id={orden}
          onChange={(evento) => alCambiar({ ...filtros, orden: evento.target.value as Orden })}
          value={filtros.orden}
        >
          {ORDENES.map(({ valor, texto }) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </div>

      {/*
        El contador está siempre, con filtros y sin ellos: es lo que deja ver de
        un vistazo que la lista está corta porque uno la ha acortado, y no
        porque no haya citas. En una región viva porque cambia sin que nada se
        mueva de sitio, y quien no ve la lista necesita enterarse igual. Con
        nombre, porque en esta pantalla hay otra —el resumen de la búsqueda—.
      */}
      <div
        aria-label="Oficinas que dejan los filtros"
        className="flex flex-col gap-2 text-base"
        role="status"
      >
        <p className="font-medium">
          {cuantasSeVen} de {oficinas.length} {oficinas.length === 1 ? 'oficina' : 'oficinas'}
        </p>

        {cuantasSeVen === 0 && <p>Ninguna oficina pasa los filtros. {porQueNoQuedaNinguna(tapando)}</p>}
      </div>

      {(tapando.length > 0 || hayFiltros(filtros)) && (
        <div className="flex flex-wrap gap-3">
          {tapando.map((filtro) => (
            <button
              className="rounded-lg border-2 border-black/30 px-4 py-2 text-base font-medium dark:border-white/30"
              key={filtro}
              onClick={() => alCambiar(quitando(filtros, filtro))}
              type="button"
            >
              Quitar el filtro de {nombreDelFiltro(filtro)}
            </button>
          ))}

          {hayFiltros(filtros) && (
            <button
              className="rounded-lg border-2 border-black/30 px-4 py-2 text-base font-medium dark:border-white/30"
              onClick={() => alCambiar(quitandoTodos(filtros))}
              type="button"
            >
              Quitar filtros
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Un grupo de opciones excluyentes, con radios de verdad.
 *
 * Radios y no botones que se pintan como elegidos: un grupo de radios se
 * recorre con las flechas y se anuncia como «2 de 4», que es lo que hace que
 * esto se pueda usar sin ver la pantalla.
 */
function Opciones<Valor extends string>({
  opciones,
  elegida,
  grupo,
  alElegir,
}: {
  opciones: Opcion<Valor>[]
  elegida: Valor
  /** El `name` que ata las opciones entre sí, y que las hace excluyentes. */
  grupo: string
  alElegir: (valor: Valor) => void
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {opciones.map(({ valor, texto }) => (
        <label className="flex items-center gap-2 text-base" key={valor}>
          <input
            checked={elegida === valor}
            name={grupo}
            onChange={() => alElegir(valor)}
            type="radio"
            value={valor}
          />
          {texto}
        </label>
      ))}
    </div>
  )
}

/** El tope del control no es un radio: es no filtrar, y así se dice. */
function aQueDistancia(km: number): string {
  return km === KM_MAXIMO ? 'Sin límite' : enKilometros(km)
}
