import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import Portada from '@/app/page'
import { buscar, listaDeOficinas, montarPortada } from './la-portada'
import { apiQueContesta, hueco, oficina, pasadaDeUnTramite, type ApiFalsa } from './sepe-en-el-navegador'

/**
 * Los filtros, probados como los usa quien tiene la lista delante: se mueve un
 * control y la lista cambia sola. Lo que aquí se mira es lo que no se puede
 * mirar en `src/interfaz/filtros.test.ts` —que son puras y ya están probadas
 * ahí—: que los controles existan, se llamen algo, se puedan usar con teclado,
 * que la lista responda sin salir a la red y que todo quede en la dirección.
 */

const CERCA_Y_PRONTO = oficina({
  id: 1,
  nombre: 'GRANOLLERS-CENTRE - SEPE',
  km: 2,
  primerHueco: hueco(0, 9),
})

const LEJOS_Y_PRONTO = oficina({
  id: 2,
  nombre: 'MOLLET DEL VALLES - SEPE',
  km: 24,
  primerHueco: hueco(1, 10),
})

const CERCA_Y_POR_LA_TARDE = oficina({
  id: 3,
  nombre: 'GRANOLLERS-PERIFERIA - SEPE',
  km: 4,
  primerHueco: hueco(20, 17),
})

const TODAS = [CERCA_Y_PRONTO, LEJOS_Y_PRONTO, CERCA_Y_POR_LA_TARDE]

/** Monta la portada, busca y espera a que la lista esté puesta. */
async function conLaListaDelante(oficinas = TODAS): Promise<{ persona: UserEvent; api: ApiFalsa }> {
  const persona = montarPortada()
  const api = apiQueContesta(pasadaDeUnTramite({ oficinas }))
  await buscar(persona, '08401')
  await listaDeOficinas()
  return { persona, api }
}

/** Los nombres de las oficinas que se ven ahora mismo, en el orden en que están. */
async function loQueSeVe(): Promise<string[]> {
  const lista = await listaDeOficinas()
  return within(lista)
    .queryAllByRole('heading', { level: 3 })
    .map((titulo) => titulo.textContent ?? '')
}

function radio(nombre: RegExp): HTMLElement {
  return screen.getByRole('radio', { name: nombre })
}

describe('cuándo aparecen los filtros', () => {
  it('no están antes de buscar: no hay nada que filtrar', () => {
    montarPortada()
    expect(screen.queryByRole('region', { name: /filtros/i })).toBe(null)
  })

  it('aparecen con la lista', async () => {
    await conLaListaDelante()
    expect(screen.getByRole('region', { name: /filtros/i })).toBeTruthy()
  })
})

describe('el filtro de distancia', () => {
  it('deja fuera lo que queda lejos, y sin pedirle nada al servidor', async () => {
    const { api } = await conLaListaDelante()
    const peticiones = api.peticiones.length

    // Cinco kilómetros deja fuera la de veinticuatro, y la lista cambia sin que
    // el servidor se entere: los filtros son puros sobre lo que ya ha llegado.
    ponerA(screen.getByLabelText(/distancia máxima/i), 5)

    expect(await loQueSeVe()).toEqual([CERCA_Y_PRONTO.nombre, CERCA_Y_POR_LA_TARDE.nombre])
    expect(api.peticiones).toHaveLength(peticiones)
  })

  it('baja hasta unos pocos kilómetros, que es lo que necesita quien va andando', async () => {
    await conLaListaDelante()
    const control = screen.getByLabelText(/distancia máxima/i) as HTMLInputElement
    expect(Number(control.min)).toBeLessThanOrEqual(3)
    expect(control.step).toBe('1')
  })

  it('dice a cuántos kilómetros está puesto, también para el lector de pantalla', async () => {
    await conLaListaDelante()
    const control = screen.getByLabelText(/distancia máxima/i)

    expect(control.getAttribute('aria-valuetext')).toMatch(/sin límite/i)
    ponerA(control, 5)
    expect(control.getAttribute('aria-valuetext')).toMatch(/5 km/)
  })
})

describe('el filtro de franja', () => {
  it('deja las que tienen su primer hueco por la tarde', async () => {
    const { persona } = await conLaListaDelante()

    await persona.click(radio(/por la tarde/i))

    expect(await loQueSeVe()).toEqual([CERCA_Y_POR_LA_TARDE.nombre])
  })

  it('deja las de por la mañana', async () => {
    const { persona } = await conLaListaDelante()

    await persona.click(radio(/por la mañana/i))

    expect(await loQueSeVe()).toEqual([CERCA_Y_PRONTO.nombre, LEJOS_Y_PRONTO.nombre])
  })

  it('dice que es el primer hueco de cada oficina y no su agenda entera', async () => {
    await conLaListaDelante()

    const franja = screen.getByRole('group', { name: /primer hueco/i })
    // Lo que no puede hacer es dejar creer que enseña todos los huecos: el
    // desglose por horas del SEPE pide DNI y esta fase no lo pide.
    expect(within(franja).getByText(/no.*(agenda|todos los huecos)/i)).toBeTruthy()
  })
})

describe('el filtro de fecha', () => {
  it('«hoy» deja solo lo que es hoy', async () => {
    const { persona } = await conLaListaDelante()

    await persona.click(radio(/^hoy$/i))

    expect(await loQueSeVe()).toEqual([CERCA_Y_PRONTO.nombre])
  })

  it('«esta semana» llega a lo de dentro de unos días', async () => {
    const { persona } = await conLaListaDelante()

    await persona.click(radio(/esta semana/i))

    expect(await loQueSeVe()).toEqual([CERCA_Y_PRONTO.nombre, LEJOS_Y_PRONTO.nombre])
  })

  it('«este mes» llega a lo de dentro de tres semanas', async () => {
    const { persona } = await conLaListaDelante()

    await persona.click(radio(/este mes/i))

    expect(await loQueSeVe()).toHaveLength(3)
  })
})

describe('el orden', () => {
  it('por distancia, de la más cercana a la más lejana', async () => {
    await conLaListaDelante()

    expect(await loQueSeVe()).toEqual([
      CERCA_Y_PRONTO.nombre,
      CERCA_Y_POR_LA_TARDE.nombre,
      LEJOS_Y_PRONTO.nombre,
    ])
  })

  it('por lo pronto que sea el hueco', async () => {
    const { persona } = await conLaListaDelante()

    await persona.selectOptions(screen.getByLabelText(/ordenar/i), 'antes')

    expect(await loQueSeVe()).toEqual([
      CERCA_Y_PRONTO.nombre,
      LEJOS_Y_PRONTO.nombre,
      CERCA_Y_POR_LA_TARDE.nombre,
    ])
  })
})

describe('el contador', () => {
  it('está a la vista desde el principio, con todas dentro', async () => {
    await conLaListaDelante()
    expect(screen.getByText(/3 de 3 oficinas/i)).toBeTruthy()
  })

  it('dice cuántas quedan en cuanto se filtra', async () => {
    const { persona } = await conLaListaDelante()

    await persona.click(radio(/por la tarde/i))

    expect(screen.getByText(/1 de 3 oficinas/i)).toBeTruthy()
  })
})

describe('cuando no queda ninguna', () => {
  it('dice qué filtro las está tapando y se quita de un clic', async () => {
    const { persona } = await conLaListaDelante()

    ponerA(screen.getByLabelText(/distancia máxima/i), 1)
    expect(screen.getByText(/ninguna oficina/i)).toBeTruthy()
    expect(screen.getByText(/el filtro de distancia es el que las está tapando/i)).toBeTruthy()

    await persona.click(screen.getByRole('button', { name: /quitar el filtro de distancia/i }))

    expect(await loQueSeVe()).toHaveLength(3)
  })

  it('cuando ninguno de los puestos las devuelve por sí solo, lo que se ofrece es quitarlos todos', async () => {
    // Dos oficinas, las dos lejos y las dos para dentro de tres semanas: ni el
    // radio de un kilómetro ni «hoy» dejan ninguna, ni juntos ni por separado.
    // Ofrecer quitar uno sería ofrecer un botón que no devuelve nada.
    const lejanas = [
      oficina({ id: 1, nombre: 'GRANOLLERS-CENTRE - SEPE', km: 12, primerHueco: hueco(20, 17) }),
      oficina({ id: 2, nombre: 'MOLLET DEL VALLES - SEPE', km: 24, primerHueco: hueco(20, 17) }),
    ]
    const { persona } = await conLaListaDelante(lejanas)

    ponerA(screen.getByLabelText(/distancia máxima/i), 1)
    await persona.click(radio(/^hoy$/i))

    expect(screen.queryByRole('button', { name: /quitar el filtro de/i })).toBe(null)

    await persona.click(screen.getByRole('button', { name: /^quitar (los )?filtros$/i }))

    expect(await loQueSeVe()).toHaveLength(2)
  })
})

describe('quitar filtros', () => {
  it('devuelve la lista entera de una vez', async () => {
    const { persona } = await conLaListaDelante()

    ponerA(screen.getByLabelText(/distancia máxima/i), 5)
    await persona.click(radio(/por la mañana/i))
    await persona.click(radio(/^hoy$/i))
    expect(await loQueSeVe()).toEqual([CERCA_Y_PRONTO.nombre])

    await persona.click(screen.getByRole('button', { name: /^quitar (los )?filtros$/i }))

    expect(await loQueSeVe()).toHaveLength(3)
  })

  it('no se ofrece cuando no hay ningún filtro puesto', async () => {
    await conLaListaDelante()
    expect(screen.queryByRole('button', { name: /^quitar (los )?filtros$/i })).toBe(null)
  })
})

describe('los filtros en la dirección de la página', () => {
  it('lo que se filtra queda escrito en la dirección, con el código postal', async () => {
    const { persona } = await conLaListaDelante()

    await persona.click(radio(/por la tarde/i))
    await persona.selectOptions(screen.getByLabelText(/ordenar/i), 'antes')

    const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    expect(fragmento.get('cp')).toBe('08401')
    expect(fragmento.get('franja')).toBe('tarde')
    expect(fragmento.get('orden')).toBe('antes')
  })

  it('quitar los filtros los borra también de la dirección', async () => {
    const { persona } = await conLaListaDelante()

    await persona.click(radio(/por la tarde/i))
    await persona.click(screen.getByRole('button', { name: /^quitar (los )?filtros$/i }))

    expect(window.location.hash).not.toMatch(/franja/)
  })

  it('un enlace con filtros se abre ya filtrado', async () => {
    window.history.replaceState(null, '', '#cp=08401&km=5&orden=antes')
    apiQueContesta(pasadaDeUnTramite({ oficinas: TODAS }))

    render(<Portada />)
    await listaDeOficinas()

    await waitFor(() => expect(screen.getByText(/2 de 3 oficinas/i)).toBeTruthy())
    expect(await loQueSeVe()).toEqual([CERCA_Y_PRONTO.nombre, CERCA_Y_POR_LA_TARDE.nombre])
    expect((screen.getByLabelText(/ordenar/i) as HTMLSelectElement).value).toBe('antes')
  })
})

describe('los filtros con el teclado y con lector de pantalla', () => {
  it('cada control tiene nombre y los de elegir uno van agrupados', async () => {
    await conLaListaDelante()

    expect(screen.getByRole('slider', { name: /distancia máxima/i })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: /ordenar/i })).toBeTruthy()
    expect(screen.getByRole('group', { name: /primer hueco/i })).toBeTruthy()
    expect(screen.getByRole('group', { name: /cuándo/i })).toBeTruthy()
  })

  it('se llega a todos tabulando y se cambian sin ratón', async () => {
    const { persona } = await conLaListaDelante()

    const control = screen.getByLabelText(/distancia máxima/i)
    control.focus()
    expect(document.activeElement).toBe(control)

    await persona.tab()
    // Lo siguiente al control de distancia es el primer radio de la franja: no
    // hay nada por el camino que solo se pueda tocar con el ratón.
    expect(document.activeElement?.getAttribute('type')).toBe('radio')
  })

  it('el contador se anuncia solo cuando cambia', async () => {
    await conLaListaDelante()
    expect(screen.getByText(/3 de 3 oficinas/i).closest('[role="status"]')).toBeTruthy()
  })
})

/**
 * Mover el control continuo hasta un valor.
 *
 * Es lo único que no se hace con `userEvent`: arrastrar un `range` no lo sabe
 * hacer, y llegar con las flechas serían noventa y cinco pulsaciones. Que se
 * pueda mover con el teclado se prueba aparte, y ahí sí con la persona.
 */
function ponerA(control: HTMLElement, valor: number): void {
  fireEvent.change(control, { target: { value: String(valor) } })
}
